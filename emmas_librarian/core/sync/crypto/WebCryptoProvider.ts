import type { Bytes, CryptoProvider, EcKeyPair } from './CryptoProvider';
import { fromBase64Url, toBase64Url } from './bytes';

const CURVE = 'P-256';

/** The part of the standard `Crypto` object this class uses; tests pass the real one or a fake. */
export interface WebCryptoLike {
  subtle: SubtleCrypto;
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

/**
 * CryptoProvider on the standard Web Crypto API, which both Node (the desktop) and the Android WebView (the
 * phone) have. P-256 is used instead of X25519 because older WebViews do not support the latter.
 *
 * Usage:
 *   const crypto = new WebCryptoProvider(globalThis.crypto);
 */
export class WebCryptoProvider implements CryptoProvider {
  constructor(private readonly webCrypto: WebCryptoLike) {}

  public randomBytes(length: number): Bytes {
    return this.webCrypto.getRandomValues(new Uint8Array(length));
  }

  public async generateKeyPair(): Promise<EcKeyPair> {
    const pair = await this.webCrypto.subtle.generateKey({ name: 'ECDH', namedCurve: CURVE }, true, ['deriveBits']);
    const publicKey = new Uint8Array(await this.webCrypto.subtle.exportKey('raw', pair.publicKey));
    const jwk = await this.webCrypto.subtle.exportKey('jwk', pair.privateKey);
    return { publicKey, privateKey: fromBase64Url(jwk.d ?? '') };
  }

  public async sharedSecret(own: EcKeyPair, peerPublicKey: Bytes): Promise<Bytes> {
    const subtle = this.webCrypto.subtle;
    const peer = await subtle.importKey('raw', peerPublicKey, { name: 'ECDH', namedCurve: CURVE }, false, []);
    const priv = await subtle.importKey('jwk', privateJwk(own), { name: 'ECDH', namedCurve: CURVE }, false, [
      'deriveBits',
    ]);
    return new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: peer }, priv, 256));
  }

  public async hkdf(secret: Bytes, salt: Bytes, info: Bytes, length: number): Promise<Bytes> {
    const key = await this.webCrypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
    const bits = await this.webCrypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
    return new Uint8Array(bits);
  }

  public async hmacSha256(key: Bytes, data: Bytes): Promise<Bytes> {
    const imported = await this.webCrypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    return new Uint8Array(await this.webCrypto.subtle.sign('HMAC', imported, data));
  }

  public async sha256(data: Bytes): Promise<Bytes> {
    return new Uint8Array(await this.webCrypto.subtle.digest('SHA-256', data));
  }

  public async seal(key: Bytes, nonce: Bytes, plaintext: Bytes, aad: Bytes): Promise<Bytes> {
    const aes = await this.aesKey(key, 'encrypt');
    return new Uint8Array(
      await this.webCrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, aes, plaintext),
    );
  }

  public async open(key: Bytes, nonce: Bytes, sealed: Bytes, aad: Bytes): Promise<Bytes> {
    const aes = await this.aesKey(key, 'decrypt');
    return new Uint8Array(
      await this.webCrypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, aes, sealed),
    );
  }

  private aesKey(key: Bytes, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
    return this.webCrypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [usage]);
  }
}

function privateJwk(pair: EcKeyPair): JsonWebKey {
  const x = pair.publicKey.slice(1, 33);
  const y = pair.publicKey.slice(33, 65);
  return { kty: 'EC', crv: CURVE, x: toBase64Url(x), y: toBase64Url(y), d: toBase64Url(pair.privateKey) };
}
