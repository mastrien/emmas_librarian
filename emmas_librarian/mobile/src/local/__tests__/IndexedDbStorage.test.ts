import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDbStorage, openMobileDatabase } from '../IndexedDbStorage';
import { emptyState } from '../libraryState';

let storage: IndexedDbStorage;

beforeEach(async () => {
  storage = new IndexedDbStorage(await openMobileDatabase(new IDBFactory()));
});

describe('state', () => {
  it('is empty before anything is saved', async () => {
    expect(await storage.load()).toBeNull();
  });

  it('comes back as it was saved, after reopening the database', async () => {
    const factory = new IDBFactory();
    const state = { ...emptyState('phone-1'), cursor: 7 };
    await new IndexedDbStorage(await openMobileDatabase(factory)).save(state);
    expect(await new IndexedDbStorage(await openMobileDatabase(factory)).load()).toEqual(state);
  });

  it('keeps only the last state saved', async () => {
    await storage.save({ ...emptyState('a'), cursor: 1 });
    await storage.save({ ...emptyState('a'), cursor: 2 });
    expect((await storage.load())?.cursor).toBe(2);
  });
});

describe('PDFs', () => {
  it('stores and gives back the bytes', async () => {
    await storage.put('art-1', new Uint8Array([37, 80, 68, 70]));
    expect(Array.from((await storage.get('art-1')) ?? [])).toEqual([37, 80, 68, 70]);
  });

  it('says none for an article that was not downloaded', async () => {
    expect(await storage.get('nope')).toBeNull();
  });

  it('lists the sizes and forgets a removed PDF', async () => {
    await storage.put('a', new Uint8Array(10));
    await storage.put('b', new Uint8Array(3));
    await storage.remove('a');
    expect(await storage.sizes()).toEqual({ b: 3 });
  });

  it('forgets everything on clear', async () => {
    await storage.save(emptyState('x'));
    await storage.put('a', new Uint8Array(1));
    await storage.clear();
    expect(await storage.load()).toBeNull();
    expect(await storage.sizes()).toEqual({});
  });
});

describe('identity', () => {
  const desktop = {
    deviceId: 'd1',
    deviceName: 'Pixel',
    deviceKey: 'a2V5',
    baseUrl: 'http://192.168.0.10:47811',
    verificationCode: '4F2A',
    pairedAt: 1,
  };

  it('is empty before pairing, and kept after it', async () => {
    expect(await storage.loadIdentity()).toBeNull();
    await storage.saveIdentity(desktop);
    expect(await storage.loadIdentity()).toEqual(desktop);
  });

  it('is forgotten with everything else on clear', async () => {
    await storage.saveIdentity(desktop);
    await storage.clear();
    expect(await storage.loadIdentity()).toBeNull();
  });
});
