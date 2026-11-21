/** Bytes backed by a plain ArrayBuffer, the only kind Web Crypto accepts. */
export type Bytes = Uint8Array<ArrayBuffer>;

/** A P-256 key pair as bytes: 65-byte uncompressed public key, 32-byte private scalar. */
export interface EcKeyPair {
  publicKey: Bytes;
  privateKey: Bytes;
}

/**
 * The only door from the sync code to cryptography. Owned by this project so the primitives behind it can be
 * swapped (Web Crypto today, in Node and in the phone's WebView) without touching the protocol, and so tests
 * can check the primitives against published vectors. Nothing outside this interface is allowed to call a
 * crypto library.
 */
export interface CryptoProvider {
  randomBytes(length: number): Bytes;
  generateKeyPair(): Promise<EcKeyPair>;
  /** ECDH on P-256: the 32-byte shared secret of our key pair and the peer's public key. */
  sharedSecret(own: EcKeyPair, peerPublicKey: Bytes): Promise<Bytes>;
  /** HKDF-SHA-256 (RFC 5869). */
  hkdf(secret: Bytes, salt: Bytes, info: Bytes, length: number): Promise<Bytes>;
  hmacSha256(key: Bytes, data: Bytes): Promise<Bytes>;
  sha256(data: Bytes): Promise<Bytes>;
  /** AES-256-GCM; the 16-byte tag is appended to the ciphertext. */
  seal(key: Bytes, nonce: Bytes, plaintext: Bytes, aad: Bytes): Promise<Bytes>;
  /** The reverse of `seal`; throws when the key, nonce, aad or bytes are not exactly the ones used to seal. */
  open(key: Bytes, nonce: Bytes, sealed: Bytes, aad: Bytes): Promise<Bytes>;
}
