import { describe, it, expect, beforeEach } from 'vitest';
import { WebCryptoProvider } from '../WebCryptoProvider';
import { PROTOCOL_VERSION, SecureChannel, deriveSessionKey, nonceFor } from '../SecureChannel';
import { fromBase64Url, toBase64Url, toHex, utf8 } from '../bytes';

const crypto = new WebCryptoProvider(globalThis.crypto);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

let phone: SecureChannel;
let desktop: SecureChannel;

beforeEach(async () => {
  const deviceKey = crypto.randomBytes(32);
  const key = await deriveSessionKey(crypto, deviceKey, crypto.randomBytes(16), crypto.randomBytes(16));
  phone = new SecureChannel(crypto, key, 'phone', 'dev-1');
  desktop = new SecureChannel(crypto, key, 'desktop', 'dev-1');
});

describe('SecureChannel', () => {
  it('delivers what one side sealed to the other, in both directions', async () => {
    expect(text(await desktop.unseal(await phone.seal(utf8('from phone'))))).toBe('from phone');
    expect(text(await phone.unseal(await desktop.seal(utf8('from desktop'))))).toBe('from desktop');
  });

  it('does not leave the plaintext readable in the message', async () => {
    const sealed = await phone.seal(utf8('top secret diary'));
    expect(text(fromBase64Url(sealed.ciphertext))).not.toContain('secret');
  });

  it('refuses a message whose bytes were altered', async () => {
    const sealed = await phone.seal(utf8('hello'));
    const bytes = fromBase64Url(sealed.ciphertext);
    bytes[0] ^= 1;
    await expect(desktop.unseal({ ...sealed, ciphertext: toBase64Url(bytes) })).rejects.toThrow(
      'Message 1 failed authentication',
    );
  });

  it('refuses a replayed message', async () => {
    const sealed = await phone.seal(utf8('pay once'));
    await desktop.unseal(sealed);
    await expect(desktop.unseal(sealed)).rejects.toThrow(
      'Message counter 1 is not greater than the last one accepted (1)',
    );
  });

  it('refuses a message that goes back in order', async () => {
    const first = await phone.seal(utf8('one'));
    const second = await phone.seal(utf8('two'));
    await desktop.unseal(second);
    await expect(desktop.unseal(first)).rejects.toThrow('possible replay');
  });

  it('refuses a message with a forged counter, because the counter is part of what is authenticated', async () => {
    const sealed = await phone.seal(utf8('one'));
    await expect(desktop.unseal({ ...sealed, counter: 5 })).rejects.toThrow('failed authentication');
  });

  it('refuses its own message sent back to it (a reflection attack)', async () => {
    const sealed = await phone.seal(utf8('mine'));
    await expect(phone.unseal(sealed)).rejects.toThrow('failed authentication');
  });

  it('refuses a message for another device with the same key material', async () => {
    const key = crypto.randomBytes(32);
    const a = new SecureChannel(crypto, key, 'phone', 'dev-A');
    const b = new SecureChannel(crypto, key, 'desktop', 'dev-B');
    await expect(b.unseal(await a.seal(utf8('x')))).rejects.toThrow('failed authentication');
  });

  it('refuses another protocol version, naming both', async () => {
    const sealed = await phone.seal(utf8('x'));
    await expect(desktop.unseal({ ...sealed, version: PROTOCOL_VERSION + 1 })).rejects.toThrow(
      'version 2 is not supported; expected 1',
    );
  });
});

describe('deriveSessionKey', () => {
  it('gives the same key to both sides and a new key for every session', async () => {
    const deviceKey = crypto.randomBytes(32);
    const [phoneNonce, desktopNonce] = [crypto.randomBytes(16), crypto.randomBytes(16)];
    const one = await deriveSessionKey(crypto, deviceKey, phoneNonce, desktopNonce);
    const again = await deriveSessionKey(crypto, deviceKey, phoneNonce, desktopNonce);
    const next = await deriveSessionKey(crypto, deviceKey, crypto.randomBytes(16), desktopNonce);
    expect(toHex(one)).toBe(toHex(again));
    expect(toHex(one)).not.toBe(toHex(next));
  });
});

describe('nonceFor (#207 review, T1)', () => {
  it('never gives the phone and the computer the same nonce for the same counter', () => {
    for (const counter of [1, 2, 255, 2 ** 32]) {
      expect(toHex(nonceFor('phone', counter))).not.toBe(toHex(nonceFor('desktop', counter)));
    }
  });

  it('gives each counter of one side its own nonce, 12 bytes long', () => {
    expect(nonceFor('phone', 1)).toHaveLength(12);
    expect(toHex(nonceFor('phone', 1))).not.toBe(toHex(nonceFor('phone', 2)));
  });
});

describe('deriveSessionKey with the computer nonce (#207 review, T2)', () => {
  it('gives two sessions of the same phone different keys when only the computer nonce differs', async () => {
    const deviceKey = crypto.randomBytes(32);
    const phoneNonce = crypto.randomBytes(16);
    const first = await deriveSessionKey(crypto, deviceKey, phoneNonce, crypto.randomBytes(16));
    const second = await deriveSessionKey(crypto, deviceKey, phoneNonce, crypto.randomBytes(16));
    expect(toHex(first)).not.toBe(toHex(second));
  });

  it('does not open in one session what the other session sealed', async () => {
    const deviceKey = crypto.randomBytes(32);
    const phoneNonce = crypto.randomBytes(16);
    const keyA = await deriveSessionKey(crypto, deviceKey, phoneNonce, crypto.randomBytes(16));
    const keyB = await deriveSessionKey(crypto, deviceKey, phoneNonce, crypto.randomBytes(16));
    const sealed = await new SecureChannel(crypto, keyA, 'phone', 'dev-1').seal(utf8('one session'));
    await expect(new SecureChannel(crypto, keyB, 'desktop', 'dev-1').unseal(sealed)).rejects.toThrow(
      'failed authentication',
    );
  });
});
