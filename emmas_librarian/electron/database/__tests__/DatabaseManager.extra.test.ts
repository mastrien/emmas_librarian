import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';

// Mock electron's safeStorage before importing it
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted_', ''))
  }
}));

describe('DatabaseManager Settings & Extra', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
  });

  afterEach(() => {
    dbManager.close();
    vi.clearAllMocks();
  });

  it('saves and retrieves unencrypted settings', () => {
    dbManager.setSetting('theme', 'dark');
    expect(dbManager.getSetting('theme')).toBe('dark');
  });

  it('encrypts and decrypts api_key settings', () => {
    dbManager.setSetting('api_key_openai', 'my-secret-key');
    
    // Direct check in DB to ensure it is stored encrypted (base64 encoded buffer)
    const rawValue = (dbManager as any).db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key_openai').value;
    expect(rawValue).toBe(Buffer.from('encrypted_my-secret-key').toString('base64'));

    // getSetting should decrypt it back
    const decrypted = dbManager.getSetting('api_key_openai');
    expect(decrypted).toBe('my-secret-key');
  });

  it('handles api_key with suffix _api_key', () => {
    dbManager.setSetting('custom_service_api_key', 'another-secret');
    const decrypted = dbManager.getSetting('custom_service_api_key');
    expect(decrypted).toBe('another-secret');
  });

  it('handles fallback names for scopus and wos API keys', () => {
    // 1. Scopus: save as scopus_api_key, retrieve via api_key_scopus
    dbManager.setSetting('scopus_api_key', 'scopus-val-1');
    expect(dbManager.getSetting('api_key_scopus')).toBe('scopus-val-1');

    // 2. Scopus: save as api_key_scopus, retrieve via scopus_api_key (if scopus_api_key deleted or not set)
    const db = (dbManager as any).db;
    db.prepare('DELETE FROM settings WHERE key = ?').run('scopus_api_key');
    dbManager.setSetting('api_key_scopus', 'scopus-val-2');
    expect(dbManager.getSetting('scopus_api_key')).toBe('scopus-val-2');

    // 3. WoS: save as wos_api_key, retrieve via api_key_wos
    dbManager.setSetting('wos_api_key', 'wos-val-1');
    expect(dbManager.getSetting('api_key_wos')).toBe('wos-val-1');

    // 4. WoS: save as api_key_wos, retrieve via wos_api_key
    db.prepare('DELETE FROM settings WHERE key = ?').run('wos_api_key');
    dbManager.setSetting('api_key_wos', 'wos-val-2');
    expect(dbManager.getSetting('wos_api_key')).toBe('wos-val-2');
  });

  it('manages diary entries', () => {
    const proj = dbManager.createProject('Diary Project');
    const date = '2023-10-15';
    
    dbManager.saveDiaryEntry(proj.id, date, 'First diary content');
    let entry = dbManager.getDiaryEntry(proj.id, date);
    expect(entry?.content).toBe('First diary content');

    const allEntries = dbManager.getDiaryEntries(proj.id);
    expect(allEntries).toHaveLength(1);

    dbManager.saveDiaryEntry(proj.id, date, 'Updated diary content');
    entry = dbManager.getDiaryEntry(proj.id, date);
    expect(entry?.content).toBe('Updated diary content');

    dbManager.deleteDiaryEntry(proj.id, date);
    expect(dbManager.getDiaryEntry(proj.id, date)).toBeUndefined();
  });
});
