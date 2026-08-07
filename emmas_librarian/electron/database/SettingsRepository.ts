import type { Database } from 'better-sqlite3';
import { safeStorage } from 'electron';

export class SettingsRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  private isKeyEncrypted(key: string): boolean {
    return key.includes('api_key');
  }

  public getSetting(key: string): string | null {
    let row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) {
      // Fallbacks for scopus and wos keys due to naming inconsistency in settings vs search
      let fallbackKey: string | null = null;
      if (key === 'scopus_api_key') fallbackKey = 'api_key_scopus';
      else if (key === 'api_key_scopus') fallbackKey = 'scopus_api_key';
      else if (key === 'wos_api_key') fallbackKey = 'api_key_wos';
      else if (key === 'api_key_wos') fallbackKey = 'wos_api_key';

      if (fallbackKey) {
        row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(fallbackKey) as
          | { value: string }
          | undefined;
        if (row) {
          key = fallbackKey;
        }
      }
    }
    
    if (row && this.isKeyEncrypted(key)) {
      try {
        const buf = Buffer.from(row.value, 'base64');
        return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : row.value;
      } catch (e) {
        return row.value;
      }
    }
    
    return row ? row.value : null;
  }

  public setSetting(key: string, value: string): void {
    let finalValue = value;
    if (this.isKeyEncrypted(key) && safeStorage.isEncryptionAvailable()) {
      finalValue = safeStorage.encryptString(value).toString('base64');
    }
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, finalValue);
  }
}
