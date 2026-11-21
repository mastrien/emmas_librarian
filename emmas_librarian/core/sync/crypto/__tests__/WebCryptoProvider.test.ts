import { describe, it, expect } from 'vitest';
import { WebCryptoProvider } from '../WebCryptoProvider';
import { fromHex, toHex, utf8 } from '../bytes';

const crypto = new WebCryptoProvider(globalThis.crypto);

// Published vectors: they check the primitives against someone else's answers, not against our own code.
describe('WebCryptoProvider against published test vectors', () => {
  it('HKDF-SHA-256 matches RFC 5869 test case 1', async () => {
    const ikm = fromHex('0b'.repeat(22));
    const salt = fromHex('000102030405060708090a0b0c');
    const info = fromHex('f0f1f2f3f4f5f6f7f8f9');
    const okm = await crypto.hkdf(ikm, salt, info, 42);
    expect(toHex(okm)).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  });

  it('HMAC-SHA-256 matches RFC 4231 test case 1', async () => {
    const tag = await crypto.hmacSha256(fromHex('0b'.repeat(20)), utf8('Hi There'));
    expect(toHex(tag)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });

  it('SHA-256 matches the value of "abc"', async () => {
    expect(toHex(await crypto.sha256(utf8('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('AES-256-GCM matches NIST test case 14 (key and nonce of zeros, one zero block)', async () => {
    const sealed = await crypto.seal(new Uint8Array(32), new Uint8Array(12), new Uint8Array(16), new Uint8Array(0));
    expect(toHex(sealed)).toBe('cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919');
  });
});

describe('WebCryptoProvider behaviour', () => {
  it('derives the same ECDH secret on both sides', async () => {
    const a = await crypto.generateKeyPair();
    const b = await crypto.generateKeyPair();
    expect(toHex(await crypto.sharedSecret(a, b.publicKey))).toBe(toHex(await crypto.sharedSecret(b, a.publicKey)));
  });

  it('gives an uncompressed 65-byte public key and a 32-byte private scalar', async () => {
    const pair = await crypto.generateKeyPair();
    expect([pair.publicKey.length, pair.publicKey[0], pair.privateKey.length]).toEqual([65, 4, 32]);
  });

  it('refuses to open a message sealed with another key, another nonce or other associated data', async () => {
    const key = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);
    const sealed = await crypto.seal(key, nonce, utf8('secret'), utf8('aad'));
    await expect(crypto.open(crypto.randomBytes(32), nonce, sealed, utf8('aad'))).rejects.toThrow();
    await expect(crypto.open(key, crypto.randomBytes(12), sealed, utf8('aad'))).rejects.toThrow();
    await expect(crypto.open(key, nonce, sealed, utf8('other'))).rejects.toThrow();
  });
});
