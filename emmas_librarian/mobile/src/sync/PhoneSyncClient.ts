import type { CryptoProvider, Bytes } from '../../../core/sync/crypto/CryptoProvider';
import { fromBase64Url, toBase64Url, utf8 } from '../../../core/sync/crypto/bytes';
import { SecureChannel, deriveSessionKey, type SealedMessage } from '../../../core/sync/crypto/SecureChannel';
import type { DecidedChange } from '../../../core/sync/PendingChangeStore';
import type { SyncOperation } from '../../../core/sync/operations';
import type { SyncRequest, SyncResponse } from '../../../core/sync/syncProtocol';
import type { LocalLibrary } from '../local/LocalLibrary';

/** The two calls the computer answers, with whatever carries them (HTTPS on the local network). */
export interface SyncTransport {
  hello(deviceId: string, phoneNonce: string): Promise<{ sessionId: string; desktopNonce: string }>;
  round(sessionId: string, message: SealedMessage): Promise<SealedMessage>;
}

/** The phone's half of pairing: who it is to the computer, and the long-lived secret they share. */
export interface PhoneIdentity {
  deviceId: string;
  deviceKey: Bytes;
}

export interface SyncReport {
  sent: number;
  staged: number;
  applied: number;
  undone: number;
  received: number;
}

function parseResponse(raw: unknown): SyncResponse {
  const input = raw as Partial<SyncResponse> | null;
  const valid =
    input !== null &&
    typeof input === 'object' &&
    Array.isArray(input.decided) &&
    Array.isArray(input.operations) &&
    typeof input.cursor === 'number' &&
    typeof input.staged === 'number';
  if (!valid)
    throw new Error(`The computer sent a sync answer in an unexpected shape: ${JSON.stringify(raw)?.slice(0, 200)}`);
  return input as SyncResponse;
}

/**
 * One sync round trip from the phone: open a session, send what changed here, and apply what the computer says
 * back (its own changes, and its decisions about what this phone sent).
 *
 * Usage:
 *   const report = await new PhoneSyncClient(crypto, identity, library, transport).sync();
 */
export class PhoneSyncClient {
  constructor(
    private readonly crypto: CryptoProvider,
    private readonly identity: PhoneIdentity,
    private readonly library: LocalLibrary,
    private readonly transport: SyncTransport,
  ) {}

  public async sync(): Promise<SyncReport> {
    const channel = await this.openChannel();
    const request: SyncRequest = {
      cursor: this.library.state.cursor,
      operations: this.library.pendingOperations(),
      processed: this.library.takeProcessed(),
    };
    const response = await this.exchange(channel, request);
    return this.absorb(request, response);
  }

  private async openChannel(): Promise<{ channel: SecureChannel; sessionId: string }> {
    const phoneNonce = this.crypto.randomBytes(16);
    const hello = await this.transport.hello(this.identity.deviceId, toBase64Url(phoneNonce));
    const desktopNonce = fromBase64Url(hello.desktopNonce) as Bytes;
    const key = await deriveSessionKey(this.crypto, this.identity.deviceKey, phoneNonce, desktopNonce);
    return {
      channel: new SecureChannel(this.crypto, key, 'phone', this.identity.deviceId),
      sessionId: hello.sessionId,
    };
  }

  private async exchange(
    opened: { channel: SecureChannel; sessionId: string },
    request: SyncRequest,
  ): Promise<SyncResponse> {
    const sealed = await opened.channel.seal(utf8(JSON.stringify(request)));
    const reply = await this.transport.round(opened.sessionId, sealed);
    const plain = await opened.channel.unseal(reply);
    return parseResponse(JSON.parse(new TextDecoder().decode(plain)));
  }

  private absorb(request: SyncRequest, response: SyncResponse): SyncReport {
    this.library.forgetProcessed(request.processed);
    const undone = this.settle(response.decided);
    this.library.applyRemote(response.operations as SyncOperation[]);
    this.library.setCursor(response.cursor);
    const applied = response.decided.filter((change) => change.status === 'applied').length;
    return {
      sent: request.operations.length,
      staged: response.staged,
      applied,
      undone,
      received: response.operations.length,
    };
  }

  /** Applied changes are confirmed; refused or skipped ones are undone. Returns how many were undone. */
  private settle(decided: DecidedChange[]): number {
    const known = new Set(this.library.pendingOperations().map((operation) => operation.opId));
    const mine = decided.filter((change) => known.has(change.opId));
    this.library.confirm(mine.filter((change) => change.status === 'applied').map((change) => change.opId));
    const refused = mine.filter((change) => change.status !== 'applied').map((change) => change.opId);
    this.library.undo(refused);
    return refused.length;
  }
}
