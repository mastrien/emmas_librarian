import type { PairingAnswer } from '../../../core/sync/crypto/pairing';
import type { SealedMessage } from '../../../core/sync/crypto/SecureChannel';
import type { SyncTransport } from './PhoneSyncClient';

interface Reply<T> {
  ok: boolean;
  result?: T;
  error?: { code: string; message: string };
}

/** The computer answered, but refused: `code` is its error code (ERR_SYNC_REFUSED, ERR_REMOTE_THROTTLED, ...). */
export class SyncRefusedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SyncRefusedError';
  }
}

/**
 * Carries the three sync calls to the computer over HTTP. Everything of value in them is already sealed by the
 * secure channel (or, for pairing, is a proof that reveals nothing), so the transport adds no secrecy of its own.
 *
 * Usage:
 *   const transport = new HttpSyncTransport('http://192.168.0.10:47811');
 *   const client = new PhoneSyncClient(crypto, identity, library, transport);
 */
export class HttpSyncTransport implements SyncTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly send: typeof fetch = (...args) => fetch(...args),
  ) {}

  public pair(answer: PairingAnswer): Promise<{ deviceId: string; deviceName: string }> {
    return this.post('pair', { answer });
  }

  public hello(deviceId: string, phoneNonce: string): Promise<{ sessionId: string; desktopNonce: string }> {
    return this.post('hello', { deviceId, phoneNonce });
  }

  public round(sessionId: string, message: SealedMessage): Promise<SealedMessage> {
    return this.post('round', { sessionId, message });
  }

  public pdf(sessionId: string, message: SealedMessage): Promise<SealedMessage> {
    return this.post('pdf', { sessionId, message });
  }

  private async post<T>(step: string, body: object): Promise<T> {
    const response = await this.send(`${this.baseUrl}/api/sync/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const reply = (await response.json().catch(() => ({}))) as Reply<T>;
    if (response.ok && reply.ok && reply.result !== undefined) return reply.result;
    const { code = 'ERR_INTERNAL', message = `The computer answered ${response.status}.` } = reply.error ?? {};
    throw new SyncRefusedError(code, message, response.status);
  }
}
