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
