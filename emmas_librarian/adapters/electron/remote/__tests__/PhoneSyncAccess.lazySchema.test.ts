// The sync schema must reach a library only when a phone is paired (#207 review, M1).
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FakeSecretStore } from '../../../../core/ports/__tests__/fakes/FakeSecretStore';
import { LibrarySync } from '../../../../core/sync/LibrarySync';
import { WebCryptoProvider } from '../../../../core/sync/crypto/WebCryptoProvider';
import { answerPairingOffer, type PairingOffer } from '../../../../core/sync/crypto/pairing';
import { fromBase64Url, toBase64Url } from '../../../../core/sync/crypto/bytes';
import { PhoneSyncAccess } from '../PhoneSyncAccess';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../../../core/database/schema.sql'), 'utf8');
const crypto = new WebCryptoProvider(globalThis.crypto);

let dir: string;
let raw: Database.Database;
const opened: Database.Database[] = [];

function openLibrary(): Database.Database {
  const library = new Database(':memory:');
  library.exec(SCHEMA);
  opened.push(library);
  return library;
}

const accessOver = (library: Database.Database): PhoneSyncAccess => {
  const sync = new LibrarySync(library);
  return new PhoneSyncAccess({ userData: dir, secrets: new FakeSecretStore(), syncParts: () => sync.parts() });
};

const syncObjects = (library: Database.Database): string[] =>
  (library.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'sync_*'").all() as { name: string }[]).map(
    (row) => row.name,
  );

async function pair(access: PhoneSyncAccess): Promise<string> {
  const { url } = await access.offerUrl('192.168.0.10', 47810);
  const offer = JSON.parse(new TextDecoder().decode(fromBase64Url(url.split('#sync=')[1]))) as PairingOffer;
  const { answer } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', Date.now());
  return (await access.routes()!.completePairing(answer)).deviceId;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-lazysync-'));
  raw = openLibrary();
});

afterEach(() => {
  opened.splice(0).forEach((library) => library.close());
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('PhoneSyncAccess installs the sync schema lazily', () => {
  it('leaves the library untouched while the routes exist but nobody paired', async () => {
    const access = accessOver(raw);
    const routes = access.routes()!;
    await expect(routes.hello('nobody', toBase64Url(crypto.randomBytes(16)))).rejects.toThrow('No phone is paired');
    await expect(routes.round('s', { version: 1, counter: 1, ciphertext: 'x' })).rejects.toThrow('step "round"');
    expect(syncObjects(raw)).toEqual([]);
  });

  it('installs it when the first pairing offer is opened', async () => {
    await accessOver(raw).offerUrl('192.168.0.10', 47810);
    expect(syncObjects(raw)).toContain('sync_ids');
    expect(syncObjects(raw)).toContain('sync_projects_ai');
  });

  it('serves a phone paired in an earlier run right after a restart, installing the schema then', async () => {
    const deviceId = await pair(accessOver(raw));
    const afterRestart = openLibrary();
    expect(syncObjects(afterRestart)).toEqual([]);

    const reply = await accessOver(afterRestart)
      .routes()!
      .hello(deviceId, toBase64Url(crypto.randomBytes(16)));

    expect(reply.sessionId).not.toBe('');
    expect(syncObjects(afterRestart)).toContain('sync_ids');
  });
});
