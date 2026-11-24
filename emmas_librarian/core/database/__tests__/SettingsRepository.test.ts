import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SettingsRepository } from '../SettingsRepository';
import fs from 'fs';
import path from 'path';
import { FakeSecretStore } from '../../ports/__tests__/fakes/FakeSecretStore';

describe('SettingsRepository', () => {
  let db: Database.Database;
  let repo: SettingsRepository;
  let secrets: FakeSecretStore;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);
    secrets = new FakeSecretStore();
    repo = new SettingsRepository(db, secrets);
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

  const storedValue = (key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string }).value;

  it('stores an API key encrypted by the secret store and reads it back', () => {
    repo.setSetting('api_key_openai', 'sk-123');

    expect(storedValue('api_key_openai')).toBe(Buffer.from('encrypted_sk-123').toString('base64'));
    expect(repo.getSetting('api_key_openai')).toBe('sk-123');
  });

  it('stores settings that are not API keys as given', () => {
    repo.setSetting('theme', 'dark');

    expect(storedValue('theme')).toBe('dark');
  });

  it('stores and reads an API key as plain text where the machine cannot encrypt', () => {
    secrets.available = false;

    repo.setSetting('api_key_openai', 'sk-123');

    expect(storedValue('api_key_openai')).toBe('sk-123');
    expect(repo.getSetting('api_key_openai')).toBe('sk-123');
  });

  it('returns the stored value when the secret store cannot decrypt it', () => {
    repo.setSetting('api_key_openai', 'sk-123');
    secrets.failDecrypt = true;

    expect(repo.getSetting('api_key_openai')).toBe(Buffer.from('encrypted_sk-123').toString('base64'));
  });

  it('keeps API keys in plain text when no secret store is given', () => {
    const plain = new SettingsRepository(db);

    plain.setSetting('api_key_openai', 'sk-123');

    expect(storedValue('api_key_openai')).toBe('sk-123');
    expect(plain.getSetting('api_key_openai')).toBe('sk-123');
  });
});
