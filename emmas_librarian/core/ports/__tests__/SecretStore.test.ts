import { describe, it, expect } from 'vitest';
import { PlainTextSecretStore } from '../SecretStore';

describe('PlainTextSecretStore', () => {
  const store = new PlainTextSecretStore();

  it('says it cannot encrypt, so callers store the value as given', () => {
    expect(store.canEncrypt()).toBe(false);
  });

  it('refuses to encrypt or decrypt, naming what it received', () => {
    expect(() => store.encrypt('abc')).toThrow('received a 3-character secret');
    expect(() => store.decrypt(Buffer.from('abcd'))).toThrow('received 4 bytes');
  });
});
