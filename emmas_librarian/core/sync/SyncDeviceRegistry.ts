import type { Bytes } from './crypto/CryptoProvider';
import { fromBase64Url, toBase64Url } from './crypto/bytes';
import type { PairedDevice } from './crypto/pairing';

/** A phone that finished pairing, as kept on disk. The key is base64url text; the store must keep it secret. */
export interface StoredSyncDevice {
  deviceId: string;
  deviceName: string;
  deviceKey: string;
  pairedAt: number;
}

/** Where the paired phone lives between runs. The real one encrypts with the system vault; tests use a fake. */
export interface SyncDeviceStore {
  read(): StoredSyncDevice[];
  write(devices: StoredSyncDevice[]): void;
}

export interface KnownSyncDevice {
  deviceId: string;
  deviceName: string;
  deviceKey: Bytes;
}

/**
 * The paired phone. A computer pairs with one phone (plan 2026-11-21): pairing another replaces the first, which
 * is how "change of phone" works, and `revoke` forgets it.
 *
 * Usage:
 *   registry.add(pairedDevice, Date.now());
 *   registry.get(deviceId)?.deviceKey;
 */
export class SyncDeviceRegistry {
  constructor(private readonly store: SyncDeviceStore) {}

  /** Stores the new phone and returns the ids of the ones it replaced. */
  public add(device: PairedDevice, now: number): string[] {
    const replaced = this.store.read().map((stored) => stored.deviceId);
    const stored: StoredSyncDevice = {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      deviceKey: toBase64Url(device.deviceKey),
      pairedAt: now,
    };
    this.store.write([stored]);
    return replaced.filter((id) => id !== device.deviceId);
  }

  public get(deviceId: string): KnownSyncDevice | undefined {
    const found = this.store.read().find((stored) => stored.deviceId === deviceId);
    if (!found) return undefined;
    return {
      deviceId: found.deviceId,
      deviceName: found.deviceName,
      deviceKey: fromBase64Url(found.deviceKey) as Bytes,
    };
  }

  public list(): Omit<StoredSyncDevice, 'deviceKey'>[] {
    return this.store.read().map(({ deviceId, deviceName, pairedAt }) => ({ deviceId, deviceName, pairedAt }));
  }

  /** Forgets a phone; its key stops working at once. */
  public revoke(deviceId: string): boolean {
    const devices = this.store.read();
    const kept = devices.filter((stored) => stored.deviceId !== deviceId);
    this.store.write(kept);
    return kept.length !== devices.length;
  }
}
