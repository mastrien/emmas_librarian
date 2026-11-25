import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChangeLog } from '../../../../core/sync/ChangeLog';
import { DesktopSyncHub } from '../../../../core/sync/DesktopSyncHub';
import { OperationBuilder } from '../../../../core/sync/OperationBuilder';
import { PendingChangeStore } from '../../../../core/sync/PendingChangeStore';
import { RowExporter } from '../../../../core/sync/RowExporter';
import {
  SyncDeviceRegistry,
  type StoredSyncDevice,
  type SyncDeviceStore,
} from '../../../../core/sync/SyncDeviceRegistry';
import { installSyncSchema } from '../../../../core/sync/syncSchema';
import { WebCryptoProvider } from '../../../../core/sync/crypto/WebCryptoProvider';
import { answerPairingOffer } from '../../../../core/sync/crypto/pairing';
import { LocalLibrary, type LibraryClock } from '../../local/LocalLibrary';
import { LocalProjectReader } from '../../local/LocalProjectReader';
import { MemoryPdfStorage } from '../../local/__tests__/fakes/MemoryPdfStorage';
import { PhoneSyncClient, type PhoneIdentity, type SyncTransport } from '../PhoneSyncClient';

const SCHEMA = fs.readFileSync(path.join(__dirname, '../../../../core/database/schema.sql'), 'utf8');
const crypto = new WebCryptoProvider(globalThis.crypto);

class FakeSyncDeviceStore implements SyncDeviceStore {
  private devices: StoredSyncDevice[] = [];
  public read(): StoredSyncDevice[] {
    return this.devices;
  }
  public write(devices: StoredSyncDevice[]): void {
    this.devices = devices;
  }
}

class CountingClock implements LibraryClock {
  private counter = 0;
  public now(): string {
    return '2026-11-21T09:00:00.000Z';
  }
  public newUuid(): string {
    this.counter += 1;
    return `phone-uuid-${this.counter}`;
  }
}

/** The phone talks to the hub directly, as it would over HTTPS. */
class DirectTransport implements SyncTransport {
  constructor(private readonly hub: DesktopSyncHub) {}
  public hello(deviceId: string, phoneNonce: string) {
    return this.hub.hello(deviceId, phoneNonce);
  }
  public round(sessionId: string, message: Parameters<DesktopSyncHub['round']>[1]) {
    return this.hub.round(sessionId, message);
  }
  public pdf(sessionId: string, message: Parameters<DesktopSyncHub['round']>[1]) {
    return this.hub.pdf(sessionId, message);
  }
}

let db: Database.Database;
let log: ChangeLog;
let store: PendingChangeStore;
let hub: DesktopSyncHub;
let registry: SyncDeviceRegistry;
let library: LocalLibrary;
let client: PhoneSyncClient;
let identity: PhoneIdentity;
const clockNow = 1_000_000;
const pdfFiles = new Map<string, Uint8Array>();

beforeEach(async () => {
  pdfFiles.clear();
  db = new Database(':memory:');
  db.exec(SCHEMA);
  installSyncSchema(db);
  log = new ChangeLog(db);
  const exporter = new RowExporter(db, log);
  store = new PendingChangeStore(db, log, exporter);
  registry = new SyncDeviceRegistry(new FakeSyncDeviceStore());
  hub = new DesktopSyncHub({
    crypto,
    registry,
    log,
    store,
    builder: new OperationBuilder(log, exporter, 'desktop'),
    now: () => clockNow,
    readPdf: (uuid) => pdfFiles.get(uuid) ?? null,
  });
  const offer = await hub.createOffer();
  const { answer, device } = await answerPairingOffer(crypto, offer, 'Pixel of Ana', clockNow);
  await hub.completePairing(answer);
  identity = { deviceId: device.deviceId, deviceKey: device.deviceKey };
  library = LocalLibrary.empty(identity.deviceId, new CountingClock());
  client = new PhoneSyncClient(crypto, identity, library, new DirectTransport(hub));
});

afterEach(() => db.close());

const run = (sql: string, ...params: (string | number)[]): number =>
  Number(db.prepare(sql).run(...params).lastInsertRowid);
const count = (table: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

function desktopProject(name: string): string {
  const id = run('INSERT INTO projects (name) VALUES (?)', name);
  return log.uuidOf('projects', id);
}

const applyAllPending = (): void => {
  store.apply(store.listPending().map((change) => change.operation.opId));
};

describe('pairing', () => {
  it('leaves the computer knowing exactly one phone, and the phone able to open a session', async () => {
    expect(registry.list()).toMatchObject([{ deviceId: identity.deviceId, deviceName: 'Pixel of Ana' }]);
    await expect(client.sync()).resolves.toMatchObject({ sent: 0 });
  });

  it('refuses a phone that is not paired, naming it', async () => {
    const stranger = new PhoneSyncClient(
      crypto,
      { deviceId: 'nobody', deviceKey: crypto.randomBytes(32) },
      library,
      new DirectTransport(hub),
    );
    await expect(stranger.sync()).rejects.toThrow('Device "nobody" is not paired');
  });

  it('refuses a paired phone that holds the wrong key', async () => {
    const wrong = new PhoneSyncClient(
      crypto,
      { ...identity, deviceKey: crypto.randomBytes(32) },
      library,
      new DirectTransport(hub),
    );
    await expect(wrong.sync()).rejects.toThrow('failed authentication');
  });

  it('stops serving a phone once it is revoked', async () => {
    registry.revoke(identity.deviceId);
    await expect(client.sync()).rejects.toThrow('is not paired');
  });
});

describe('from the computer to the phone', () => {
  it('copies projects and what is inside them, and does not copy again next time', async () => {
    const project = desktopProject('Review');
    const projectId = log.localIdOf('projects', project) as number;
    run(
      "INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'Mindfulness', 'C:\\\\x.pdf')",
      projectId,
    );
    run(
      "INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-11-20', 'desktop day')",
      projectId,
    );

    const first = await client.sync();
    const second = await client.sync();

    expect(first.received).toBe(3);
    expect(second.received).toBe(0);
    expect(library.rows('projects')[0]).toMatchObject({ name: 'Review' });
    expect(library.rows('articles')[0]).toMatchObject({ title: 'Mindfulness', project_id: project });
    expect(library.rows('articles')[0]).not.toHaveProperty('local_file_path');
  });

  it('brings the quick-access links of a project, with their address and without the file path (#208)', async () => {
    const project = desktopProject('With links');
    const projectId = log.localIdOf('projects', project) as number;
    run(
      "INSERT INTO project_documents (project_id, title, url, position) VALUES (?, 'Guia', 'https://example.org/guia', 1)",
      projectId,
    );
    run(
      "INSERT INTO project_documents (project_id, title, local_file_path) VALUES (?, 'Planilha', 'C:\\planilha.xlsx')",
      projectId,
    );

    await client.sync();

    const phoneProjectId = library.find('projects', project)?.id as number;
    const links = await new LocalProjectReader(library, new MemoryPdfStorage()).listDocuments(phoneProjectId);
    expect(links.map((link) => link.title).sort()).toEqual(['Guia', 'Planilha']);
    expect(links.find((link) => link.title === 'Guia')).toMatchObject({ url: 'https://example.org/guia' });
  });

  it('brings a later edit made on the computer', async () => {
    const project = desktopProject('Old name');
    await client.sync();
    db.prepare("UPDATE projects SET name = 'New name'").run();
    await client.sync();
    expect(library.find('projects', project)?.name).toBe('New name');
  });
});

describe('from the phone to the computer (dry run)', () => {
  async function phoneWritesDiary(): Promise<{ project: string; entry: string }> {
    const project = desktopProject('Review');
    await client.sync();
    const entry = library.create('project_diary', {
      project_id: project,
      entry_date: '2026-11-21',
      content: 'written offline',
    });
    return { project, entry: entry.uuid };
  }

  it('reaches the computer only as a pending change, not in the library', async () => {
    await phoneWritesDiary();
    const report = await client.sync();
    expect(report).toMatchObject({ sent: 1, staged: 1 });
    expect(count('project_diary')).toBe(0);
    expect(store.listPending()).toHaveLength(1);
  });

  it('keeps the change on the phone until the user decides, and sending again does not duplicate it', async () => {
    await phoneWritesDiary();
    await client.sync();
    const again = await client.sync();
    expect(again.staged).toBe(0);
    expect(store.listPending()).toHaveLength(1);
    expect(library.hasPending()).toBe(true);
  });

  it('appears in the library once the user applies it, and the phone then drops it from its queue', async () => {
    const { entry } = await phoneWritesDiary();
    await client.sync();
    applyAllPending();

    const report = await client.sync();

    expect(count('project_diary')).toBe(1);
    expect(report.applied).toBe(1);
    expect(library.hasPending()).toBe(false);
    expect(library.find('project_diary', entry)?.content).toBe('written offline');
  });

  it('is not echoed back as if it were a new change from the computer', async () => {
    await phoneWritesDiary();
    await client.sync();
    applyAllPending();
    const report = await client.sync();
    expect(report.received).toBe(0);
    expect(library.rows('project_diary')).toHaveLength(1);
  });

  it('is undone on the phone when the user rejects it', async () => {
    const { entry } = await phoneWritesDiary();
    await client.sync();
    store.reject(store.listPending().map((change) => change.operation.opId));

    const report = await client.sync();

    expect(report.undone).toBe(1);
    expect(library.find('project_diary', entry)).toBeUndefined();
    expect(count('project_diary')).toBe(0);
  });

  it('tells the computer the decision was seen, so it stops repeating it', async () => {
    await phoneWritesDiary();
    await client.sync();
    store.reject(store.listPending().map((change) => change.operation.opId));
    await client.sync();
    await client.sync();
    expect(store.decidedFor(identity.deviceId)).toEqual([]);
  });

  it('merges a page written on both sides by keeping the old text in the history', async () => {
    const project = desktopProject('Review');
    run(
      "INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, '2026-11-21', 'desktop text')",
      log.localIdOf('projects', project) as number,
    );
    await client.sync();
    library.create('project_diary', { project_id: project, entry_date: '2026-11-21', content: 'phone text' });
    await client.sync();
    applyAllPending();
    await client.sync();
    expect(db.prepare('SELECT content FROM project_diary_history').get()).toEqual({ content: 'desktop text' });
    expect(db.prepare('SELECT content FROM project_diary').get()).toEqual({ content: 'phone text' });
  });
});

describe('projects made on the phone', () => {
  it('never reach the computer', async () => {
    const own = library.createOwnProject('Ideas');
    library.create('articles', { project_id: own.uuid, title: 'Only here' });
    const report = await client.sync();
    expect(report.sent).toBe(0);
    expect(count('projects')).toBe(0);
    expect(library.rows('articles')).toHaveLength(1);
  });
});

describe('PDFs on request', () => {
  it('brings the PDF of an article, byte for byte, when the phone asks for it', async () => {
    const project = desktopProject('Review');
    const article = run(
      'INSERT INTO articles (project_id, title) VALUES (?, ?)',
      log.localIdOf('projects', project) as number,
      'A',
    );
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => i % 251);
    pdfFiles.set(log.uuidOf('articles', article), bytes);

    const received = await client.fetchPdf(log.uuidOf('articles', article));

    expect(received).toEqual(bytes);
  });

  it('says none when the article has no PDF on the computer', async () => {
    expect(await client.fetchPdf('unknown-article')).toBeNull();
  });
});
