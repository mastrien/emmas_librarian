import type { SecretStore } from '../../../core/ports/SecretStore';
import type { SyncRoutes } from '../../../core/remote/RemoteGateway';
import { DesktopSyncHub } from '../../../core/sync/DesktopSyncHub';
import type { LibrarySyncParts } from '../../../core/sync/LibrarySync';
import type { DecidedChange } from '../../../core/sync/PendingChangeStore';
import { SyncDeviceRegistry } from '../../../core/sync/SyncDeviceRegistry';
import { WebCryptoProvider } from '../../../core/sync/crypto/WebCryptoProvider';
import { toBase64Url, utf8 } from '../../../core/sync/crypto/bytes';
import type { PendingPhoneChange, PhoneChangeDecision, RemoteSyncDevice } from '../../../src/types/remoteAccess';
import { FileSyncDeviceStore } from './FileSyncDeviceStore';

export interface PhoneSyncHost {
  userData: string;
  secrets: SecretStore;
  /** The sync side of the open library; without it the computer does not sync. */
  syncParts?: () => LibrarySyncParts;
  now?: () => number;
}

/**
 * What the desktop app does for the phone sync: the paired phone, the pairing offer, the encrypted routes the
 * LAN server exposes, and the review of what the phone changed (the dry run). The protocol itself is in core/sync.
 *
 * Usage:
 *   const sync = new PhoneSyncAccess({ userData, secrets, syncParts: () => db.librarySync.parts() });
 *   const offerUrl = await sync.offerUrl('192.168.0.10', 47810);
 */
export class PhoneSyncAccess {
  private readonly registry: SyncDeviceRegistry;
  private hub: DesktopSyncHub | null = null;
  private verificationCode: string | null = null;

  constructor(private readonly host: PhoneSyncHost) {
    this.registry = new SyncDeviceRegistry(new FileSyncDeviceStore(host.userData, host.secrets));
  }

  public available(): boolean {
    return this.host.syncParts !== undefined;
  }

  /** The three encrypted calls for the LAN server, or undefined when this computer does not sync. */
  public routes(): SyncRoutes | undefined {
    return this.available() ? this.ensureHub() : undefined;
  }

  /** A new one-time pairing offer as the address a QR code carries; the offer travels in the fragment. */
  public async offerUrl(address: string, port: number, syncPort?: number): Promise<{ url: string; expiresAt: string }> {
    const offer = await this.ensureHub().createOffer();
    const encoded = toBase64Url(utf8(JSON.stringify({ ...offer, address, port, syncPort })));
    return { url: `https://${address}:${port}/#sync=${encoded}`, expiresAt: new Date(offer.expiresAt).toISOString() };
  }

  public device(): RemoteSyncDevice | null {
    const [stored] = this.registry.list();
    return stored ? { ...stored, verificationCode: this.verificationCode } : null;
  }

  public revoke(): void {
    for (const device of this.registry.list()) this.registry.revoke(device.deviceId);
    this.verificationCode = null;
  }

  public listPending(): PendingPhoneChange[] {
    return this.parts()
      .store.listPending()
      .map(({ operation, current }) => ({
        opId: operation.opId,
        entity: operation.entity,
        kind: operation.kind,
        fields: operation.fields,
        current,
        changedAt: operation.changedAt,
      }));
  }

  public apply(opIds: string[]): PhoneChangeDecision[] {
    return this.parts().store.apply(opIds).map(toDecision);
  }

  public reject(opIds: string[]): PhoneChangeDecision[] {
    return this.parts().store.reject(opIds).map(toDecision);
  }

  private parts(): LibrarySyncParts {
    if (!this.host.syncParts)
      throw new Error('Phone sync is not available on this computer: no library with sync support is open.');
    return this.host.syncParts();
  }

  private ensureHub(): DesktopSyncHub {
    if (this.hub) return this.hub;
    const { log, builder, store, readPdf } = this.parts();
    this.hub = new DesktopSyncHub({
      crypto: new WebCryptoProvider(globalThis.crypto),
      registry: this.registry,
      log,
      builder,
      store,
      readPdf,
      now: this.host.now ?? Date.now,
      onPaired: (device) => {
        this.verificationCode = device.verificationCode;
      },
    });
    return this.hub;
  }
}

const toDecision = (change: DecidedChange): PhoneChangeDecision => ({
  opId: change.opId,
  status: change.status,
  reason: change.reason,
});
