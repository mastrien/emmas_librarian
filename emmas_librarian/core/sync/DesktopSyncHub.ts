import { ChangeLog } from './ChangeLog';
import { DesktopSyncEndpoint, type PdfSource } from './DesktopSyncEndpoint';
import { OperationBuilder } from './OperationBuilder';
import { PendingChangeStore } from './PendingChangeStore';
import type { Bytes, CryptoProvider } from './crypto/CryptoProvider';
import { fromBase64Url, toBase64Url } from './crypto/bytes';
import {
  acceptPairingAnswer,
  createPairingOffer,
  type PairedDevice,
  type PairingAnswer,
  type PairingOffer,
  type PendingPairing,
} from './crypto/pairing';
import { SecureChannel, deriveSessionKey, type SealedMessage } from './crypto/SecureChannel';
import type { SyncDeviceRegistry } from './SyncDeviceRegistry';

export const PAIRING_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 10 * 60_000;
const MAX_SESSIONS = 8;
const NONCE_LENGTH = 16;

export interface HubParts {
  crypto: CryptoProvider;
  registry: SyncDeviceRegistry;
  log: ChangeLog;
  builder: OperationBuilder;
  store: PendingChangeStore;
  now: () => number;
  /** Reads the PDF of an article by uuid; without it every PDF answers "not found". */
  readPdf?: PdfSource;
  /** Called when a phone finishes pairing, so the settings screen can show its verification code. */
  onPaired?: (device: PairedDevice) => void;
}

interface Session {
  deviceId: string;
  endpoint: DesktopSyncEndpoint;
  expiresAt: number;
}

export interface HelloReply {
  sessionId: string;
  desktopNonce: string;
}

/**
 * What the computer exposes to a phone, with no network in it: pair, open a session, run rounds. An HTTP route
 * for each of the three is all a server has to add.
 *
 * Usage:
 *   const offer = await hub.createOffer();                      // show as QR
 *   await hub.completePairing(answerFromPhone);
 *   const { sessionId, desktopNonce } = await hub.hello(deviceId, phoneNonce);
 *   const reply = await hub.round(sessionId, sealedMessage);
 */
export class DesktopSyncHub {
  private pending: PendingPairing | null = null;
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly parts: HubParts) {}

  /** A new one-time offer; it replaces any offer not yet used. */
  public async createOffer(): Promise<PairingOffer> {
    const expiresAt = this.parts.now() + PAIRING_TTL_MS;
    const { offer, pending } = await createPairingOffer(this.parts.crypto, expiresAt);
    this.pending = pending;
    return offer;
  }

  public async completePairing(answer: PairingAnswer): Promise<PairedDevice> {
    if (!this.pending)
      throw new Error('No pairing is open on this computer; open "Parear um celular" and read the new QR code.');
    const device = await acceptPairingAnswer(this.parts.crypto, this.pending, answer, this.parts.now());
    this.pending = null;
    if (this.parts.registry.add(device, this.parts.now()).length > 0) this.sessions.clear();
    this.parts.onPaired?.(device);
    return device;
  }

  public async hello(deviceId: string, phoneNonce: string): Promise<HelloReply> {
    const device = this.parts.registry.get(deviceId);
    if (!device) throw new Error(`Device "${deviceId}" is not paired with this computer; pair it again.`);
    const desktopNonce = this.parts.crypto.randomBytes(NONCE_LENGTH);
    const key = await deriveSessionKey(
      this.parts.crypto,
      device.deviceKey,
      fromBase64Url(phoneNonce) as Bytes,
      desktopNonce,
    );
    const channel = new SecureChannel(this.parts.crypto, key, 'desktop', deviceId);
    const endpoint = new DesktopSyncEndpoint(
      channel,
      this.parts.log,
      this.parts.builder,
      this.parts.store,
      deviceId,
      this.parts.readPdf,
    );
    const sessionId = toBase64Url(this.parts.crypto.randomBytes(NONCE_LENGTH));
    this.remember(sessionId, { deviceId, endpoint, expiresAt: this.parts.now() + SESSION_TTL_MS });
    return { sessionId, desktopNonce: toBase64Url(desktopNonce) };
  }

  public async round(sessionId: string, message: SealedMessage): Promise<SealedMessage> {
    return this.sessionFor(sessionId).handleSealed(message);
  }

  public async pdf(sessionId: string, message: SealedMessage): Promise<SealedMessage> {
    return this.sessionFor(sessionId).handlePdfSealed(message);
  }

  /** Ends every open session of a phone; used when it is unpaired, so a session opened before keeps no access. */
  public closeSessionsOf(deviceId: string): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.deviceId === deviceId) this.sessions.delete(sessionId);
    }
  }

  private sessionFor(sessionId: string): DesktopSyncEndpoint {
    const session = this.sessions.get(sessionId);
    const alive = session && session.expiresAt >= this.parts.now() && this.parts.registry.get(session.deviceId);
    if (!session || !alive) {
      this.sessions.delete(sessionId);
      throw new Error(
        `Sync session "${sessionId}" is unknown, expired or of an unpaired phone; open a new one with hello.`,
      );
    }
    return session.endpoint;
  }

  private remember(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
    for (const oldest of [...this.sessions.keys()].slice(0, Math.max(0, this.sessions.size - MAX_SESSIONS))) {
      this.sessions.delete(oldest);
    }
  }
}
