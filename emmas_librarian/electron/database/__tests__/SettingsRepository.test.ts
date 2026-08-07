import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SettingsRepository } from '../SettingsRepository';
import fs from 'fs';
import path from 'path';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(str)),
    decryptString: vi.fn((buf) => buf.toString()),
  }
}));

describe('SettingsRepository', () => {
  let db: Database.Database;
  let repo: SettingsRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);
    repo = new SettingsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should get a setting that does not exist', () => {
    expect(repo.getSetting('nonexistent')).toBeNull();
  });

  it('should set and get a setting', () => {
    repo.setSetting('theme', 'dark');
    expect(repo.getSetting('theme')).toBe('dark');
  });

  it('should fallback from scopus_api_key to api_key_scopus', () => {
    repo.setSetting('api_key_scopus', 'scopus-123');
    expect(repo.getSetting('scopus_api_key')).toBe('scopus-123');
  });

  it('should fallback from api_key_scopus to scopus_api_key', () => {
    repo.setSetting('scopus_api_key', 'scopus-456');
    expect(repo.getSetting('api_key_scopus')).toBe('scopus-456');
  });

  it('should fallback from wos_api_key to api_key_wos', () => {
    repo.setSetting('api_key_wos', 'wos-123');
    expect(repo.getSetting('wos_api_key')).toBe('wos-123');
  });

  it('should fallback from api_key_wos to wos_api_key', () => {
    repo.setSetting('wos_api_key', 'wos-456');
    expect(repo.getSetting('api_key_wos')).toBe('wos-456');
  });

  it('should not fallback if the fallback key does not exist either', () => {
    expect(repo.getSetting('scopus_api_key')).toBeNull();
    expect(repo.getSetting('api_key_scopus')).toBeNull();
    expect(repo.getSetting('wos_api_key')).toBeNull();
    expect(repo.getSetting('api_key_wos')).toBeNull();
  });
});
