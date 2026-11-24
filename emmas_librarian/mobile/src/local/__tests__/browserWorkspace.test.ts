import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect } from 'vitest';
import { browserLocalEnvironment, wantsLocalLibrary } from '../browserWorkspace';

class MapStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('wantsLocalLibrary', () => {
  it('is always on in the app', () => {
    expect(wantsLocalLibrary('', new MapStorage(), true)).toBe(true);
  });

  it('is off in a browser until asked with ?local=1, and then stays on', () => {
    const storage = new MapStorage();
    expect(wantsLocalLibrary('', storage, false)).toBe(false);
    expect(wantsLocalLibrary('?local=1', storage, false)).toBe(true);
    expect(wantsLocalLibrary('', storage, false)).toBe(true);
  });

  it('is off when the browser refuses storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(wantsLocalLibrary('?local=1', blocked, false)).toBe(false);
  });
});

describe('browserLocalEnvironment', () => {
  const parts = (protocol: string) => ({
    indexedDB: new IDBFactory(),
    crypto: globalThis.crypto,
    fetch: (async () => new Response('{}')) as typeof fetch,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120',
    protocol,
    newUuid: () => globalThis.crypto.randomUUID(),
  });

  it('opens an empty workspace on the browser’s own storage', async () => {
    const workspace = await browserLocalEnvironment(parts('https:')).open();
    expect(workspace.isPaired()).toBe(false);
    expect(await workspace.reader.listProjects()).toEqual([]);
  });

  it('keeps what is written, in the same storage, when opened again', async () => {
    const shared = parts('https:');
    const first = await browserLocalEnvironment(shared).open();
    await first.reader.writer?.createProject?.('Ideas');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const again = await browserLocalEnvironment(shared).open();

    expect(await again.reader.listProjects()).toMatchObject([{ name: 'Ideas' }]);
  });

  it('passes on the scanner it was given', () => {
    const scan = async () => 'code';
    expect(browserLocalEnvironment({ ...parts('http:'), scan }).scan).toBe(scan);
  });
});
