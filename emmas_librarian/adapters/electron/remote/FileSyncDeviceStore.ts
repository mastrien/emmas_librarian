import fs from 'fs';
import path from 'path';
import type { SecretStore } from '../../../core/ports/SecretStore';
import type { StoredSyncDevice, SyncDeviceStore } from '../../../core/sync/SyncDeviceRegistry';

const FILE = 'sync-device.json';

interface FileEntry extends Omit<StoredSyncDevice, 'deviceKey'> {
  /** The device key, base64 of what the OS keychain produced, or the key itself when there is no keychain. */
  deviceKey: string;
  keyEncrypted: boolean;
}

/**
 * The paired phone's key on disk (`<userData>/sync-device.json`, owner-only), encrypted by the system vault where
 * there is one, like the LAN certificate's private key. A file that cannot be read (damaged, or made by another
 * user's keychain) counts as "no phone paired": the person pairs again.
 *
 * Usage:
 *   const registry = new SyncDeviceRegistry(new FileSyncDeviceStore(paths.userData, secrets));
 */
export class FileSyncDeviceStore implements SyncDeviceStore {
  private readonly file: string;

  constructor(
    userData: string,
    private readonly secrets: SecretStore,
  ) {
    this.file = path.join(userData, FILE);
  }

  public read(): StoredSyncDevice[] {
    try {
      const entries = JSON.parse(fs.readFileSync(this.file, 'utf8')) as FileEntry[];
      return entries.map((entry) => this.open(entry));
    } catch {
      return [];
    }
  }

  public write(devices: StoredSyncDevice[]): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(devices.map((device) => this.seal(device))), { mode: 0o600 });
  }

  private seal(device: StoredSyncDevice): FileEntry {
    const keyEncrypted = this.secrets.canEncrypt();
    const deviceKey = keyEncrypted ? this.secrets.encrypt(device.deviceKey).toString('base64') : device.deviceKey;
    return { ...device, deviceKey, keyEncrypted };
  }

  private open(entry: FileEntry): StoredSyncDevice {
    const { keyEncrypted, ...device } = entry;
    const deviceKey = keyEncrypted ? this.secrets.decrypt(Buffer.from(entry.deviceKey, 'base64')) : entry.deviceKey;
    return { ...device, deviceKey };
  }
}
