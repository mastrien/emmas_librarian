import { safeStorage } from 'electron';
import type { SecretStore } from '../../core/ports/SecretStore';

/**
 * SecretStore of the desktop app: Electron's safeStorage (DPAPI, Keychain or libsecret).
 *
 * Usage:
 *   const db = new DatabaseAdapter(dbPath, new SafeStorageSecretStore());
 */
export class SafeStorageSecretStore implements SecretStore {
  canEncrypt(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  encrypt(plainText: string): Buffer {
    return safeStorage.encryptString(plainText);
  }

  decrypt(cipher: Buffer): string {
    return safeStorage.decryptString(cipher);
  }
}
