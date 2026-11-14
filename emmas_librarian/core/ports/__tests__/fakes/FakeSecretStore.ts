import type { SecretStore } from '../../SecretStore';

const MARK = 'encrypted_';

/**
 * Reversible stand-in for the OS keychain: "encrypts" by prefixing, so a test can tell an encrypted
 * value from a plain one. `available = false` behaves like a machine without a keyring;
 * `failDecrypt = true` like a key that no longer opens the stored value.
 *
 * Usage:
 *   const secrets = new FakeSecretStore();
 *   const adapter = new DatabaseAdapter(':memory:', secrets);
 */
export class FakeSecretStore implements SecretStore {
  available = true;
  failDecrypt = false;

  canEncrypt(): boolean {
    return this.available;
  }

  encrypt(plainText: string): Buffer {
    return Buffer.from(`${MARK}${plainText}`);
  }

  decrypt(cipher: Buffer): string {
    if (this.failDecrypt) throw new Error('Decryption failed');
    return cipher.toString().replace(MARK, '');
  }
}
