import type { Bytes, CryptoProvider } from './CryptoProvider';
import { concatBytes, fromBase64Url, toBase64Url, utf8 } from './bytes';

export const PROTOCOL_VERSION = 1;

export type Role = 'phone' | 'desktop';

/** An encrypted message on the wire. `counter` is not secret; it is what makes replays detectable. */
export interface SealedMessage {
  version: number;
  counter: number;
  ciphertext: string;
}

const DIRECTION_BYTE: Record<Role, number> = { phone: 1, desktop: 2 };

function nonceFor(sender: Role, counter: number): Bytes {
  const nonce = new Uint8Array(12);
  nonce[0] = DIRECTION_BYTE[sender];
  new DataView(nonce.buffer).setBigUint64(4, BigInt(counter));
  return nonce;
}

function aadFor(deviceId: string, sender: Role, counter: number): Bytes {
  return utf8(`emma-sync/v${PROTOCOL_VERSION}|${deviceId}|${sender}|${counter}`);
}

/**
 * Both ends derive the same session key from the long-lived device key and one random nonce from each side, so
 * two sessions never share a key (and so never reuse a GCM nonce).
 */
export async function deriveSessionKey(
  crypto: CryptoProvider,
  deviceKey: Bytes,
  phoneNonce: Bytes,
  desktopNonce: Bytes,
): Promise<Bytes> {
  return crypto.hkdf(deviceKey, concatBytes(phoneNonce, desktopNonce), utf8('emma-sync/session/v1'), 32);
}

/**
 * One encrypted, authenticated conversation between a paired phone and the computer. Every message is
 * AES-256-GCM sealed; the counter is bound into the nonce and the associated data, a message that repeats or
 * goes back in order is refused, and a message sealed by this side cannot be fed back to it.
 *
 * Usage:
 *   const channel = new SecureChannel(crypto, sessionKey, 'desktop', deviceId);
 *   const sealed = await channel.seal(utf8(JSON.stringify(operations)));
 *   const plain = await otherSide.unseal(sealed);
 */
export class SecureChannel {
  private sent = 0;
  private lastReceived = 0;

  constructor(
    private readonly crypto: CryptoProvider,
    private readonly sessionKey: Bytes,
    private readonly role: Role,
    private readonly deviceId: string,
  ) {}

  public async seal(plaintext: Bytes): Promise<SealedMessage> {
    this.sent += 1;
    const aad = aadFor(this.deviceId, this.role, this.sent);
    const sealed = await this.crypto.seal(this.sessionKey, nonceFor(this.role, this.sent), plaintext, aad);
    return { version: PROTOCOL_VERSION, counter: this.sent, ciphertext: toBase64Url(sealed) };
  }

  /** @throws Error naming the counter when the message is a replay, out of order, altered or from another version */
  public async unseal(message: SealedMessage): Promise<Bytes> {
    if (message.version !== PROTOCOL_VERSION) {
      throw new Error(
        `Message protocol version ${message.version} is not supported; expected ${PROTOCOL_VERSION}. Update the older app.`,
      );
    }
    if (!Number.isSafeInteger(message.counter) || message.counter <= this.lastReceived) {
      throw new Error(
        `Message counter ${message.counter} is not greater than the last one accepted (${this.lastReceived}); possible replay.`,
      );
    }
    const peer: Role = this.role === 'phone' ? 'desktop' : 'phone';
    const aad = aadFor(this.deviceId, peer, message.counter);
    const plain = await this.openOrExplain(peer, message, aad);
    this.lastReceived = message.counter;
    return plain;
  }

  private async openOrExplain(peer: Role, message: SealedMessage, aad: Bytes): Promise<Bytes> {
    try {
      return await this.crypto.open(
        this.sessionKey,
        nonceFor(peer, message.counter),
        fromBase64Url(message.ciphertext),
        aad,
      );
    } catch {
      throw new Error(
        `Message ${message.counter} failed authentication: wrong key, wrong device or altered in transit.`,
      );
    }
  }
}
