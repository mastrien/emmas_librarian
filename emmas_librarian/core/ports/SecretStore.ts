/**
 * Port for encrypting secrets (API keys) before they are written to the library. Each shell brings
 * its own: Electron uses the OS keychain through safeStorage; a CLI may use a keyring or a key file.
 */
export interface SecretStore {
  /** False where no encryption is available (e.g. Linux without a keyring): secrets are then stored as given. */
  canEncrypt(): boolean;
  encrypt(plainText: string): Buffer;
  /** Throws when `cipher` was not produced by `encrypt` of this store on this machine. */
  decrypt(cipher: Buffer): string;
}

/**
 * A store that encrypts nothing: secrets are written and read as plain text. It is what a library
 * gets when no shell supplies a store (tests, backup files opened only to copy projects out of them).
 *
 * Usage:
 *   const adapter = new DatabaseAdapter(dbPath, new PlainTextSecretStore());
 */
export class PlainTextSecretStore implements SecretStore {
  canEncrypt(): boolean {
    return false;
  }

  encrypt(plainText: string): Buffer {
    throw new Error(
      `PlainTextSecretStore cannot encrypt (received a ${plainText.length}-character secret); expected callers to check canEncrypt() first`,
    );
  }

  decrypt(cipher: Buffer): string {
    throw new Error(
      `PlainTextSecretStore cannot decrypt (received ${cipher.length} bytes); expected callers to check canEncrypt() first`,
    );
  }
}
