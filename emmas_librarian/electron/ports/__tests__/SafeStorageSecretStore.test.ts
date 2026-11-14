import { describe, it, expect, vi } from 'vitest';

const keychain = vi.hoisted(() => ({ available: true }));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => keychain.available,
    encryptString: (plainText: string) => Buffer.from(`os:${plainText}`),
    decryptString: (cipher: Buffer) => cipher.toString().slice(3),
  },
}));

import { SafeStorageSecretStore } from '../SafeStorageSecretStore';

describe('SafeStorageSecretStore', () => {
  const store = new SafeStorageSecretStore();

  it('encrypts and decrypts through the OS keychain', () => {
    const cipher = store.encrypt('sk-123');

    expect(cipher.toString()).toBe('os:sk-123');
    expect(store.decrypt(cipher)).toBe('sk-123');
  });

  it('reports whether the OS keychain is available', () => {
    keychain.available = false;
    expect(store.canEncrypt()).toBe(false);

    keychain.available = true;
    expect(store.canEncrypt()).toBe(true);
  });
});
