// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DesktopFixture } from '../../sync/__tests__/support/DesktopFixture';
import { LocalWorkspace, type WorkspaceEnvironment } from '../LocalWorkspace';
import { MemoryWorkspaceStorage } from './fakes/MemoryWorkspaceStorage';

let desktop: DesktopFixture;
let storage: MemoryWorkspaceStorage;
let counter = 0;

const environment = (): WorkspaceEnvironment => ({
  state: storage,
  pdfs: storage.pdfs,
  identity: storage,
  wipe: () => storage.wipe(),
  crypto: desktop.crypto,
  send: desktop.send,
  clock: { now: () => '2026-11-21T09:00:00.000Z', newUuid: () => `phone-${(counter += 1)}` },
  deviceName: 'Pixel of Ana',
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  desktop = new DesktopFixture();
  storage = new MemoryWorkspaceStorage();
  counter = 0;
});

afterEach(() => desktop.close());

async function pairedWorkspace(): Promise<LocalWorkspace> {
  const workspace = await LocalWorkspace.open(environment());
  await workspace.pair(await desktop.pairingText());
  return workspace;
}

describe('LocalWorkspace', () => {
  it('starts empty and unpaired, and can already hold projects of its own', async () => {
    const workspace = await LocalWorkspace.open(environment());
    expect(workspace.isPaired()).toBe(false);
    await workspace.reader.writer?.createProject?.('Ideas');
    expect(await workspace.reader.listProjects()).toMatchObject([{ name: 'Ideas', origin: 'own' }]);
  });

  it('pairs, syncs, and shows the computer’s library', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('From the computer')");
    const workspace = await pairedWorkspace();
    await workspace.syncNow();
    expect(await workspace.reader.listProjects()).toMatchObject([{ name: 'From the computer', origin: 'synced' }]);
    expect(workspace.status()).toMatchObject({
      pairedTo: 'Pixel of Ana',
      lastSyncAt: '2026-11-21T09:00:00.000Z',
      lastError: null,
    });
  });

  it('keeps what it has after the app is closed and opened again', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('Persisted')");
    const first = await pairedWorkspace();
    await first.syncNow();
    await flush();

    const reopened = await LocalWorkspace.open(environment());

    expect(reopened.isPaired()).toBe(true);
    expect(await reopened.reader.listProjects()).toMatchObject([{ name: 'Persisted' }]);
  });

  it('keeps an offline change across a restart, still waiting for the computer', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('P')");
    const first = await pairedWorkspace();
    await first.syncNow();
    await first.reader.writer.saveDiaryEntry(1, '2026-11-21', 'offline page');
    await flush();

    const reopened = await LocalWorkspace.open(environment());

    expect(reopened.status().pendingChanges).toBe(1);
    await reopened.syncNow();
    expect(desktop.store.listPending()).toHaveLength(1);
  });

  it('records the error of a sync that failed on the network', async () => {
    const paired = await pairedWorkspace();
    await flush();
    const broken: WorkspaceEnvironment = {
      ...environment(),
      send: (async () => {
        throw new Error('network unreachable');
      }) as typeof fetch,
    };
    const offline = await LocalWorkspace.open(broken);
    await expect(offline.syncNow()).rejects.toThrow('network unreachable');
    expect(offline.status().lastError).toBe('network unreachable');
    expect(paired.isPaired()).toBe(true);
  });

  it('refuses to sync before pairing, saying how to pair', async () => {
    const workspace = await LocalWorkspace.open(environment());
    await expect(workspace.syncNow()).rejects.toThrow('read the QR code');
  });

  it('downloads the PDF of an article and keeps it for offline reading', async () => {
    const project = desktop.run("INSERT INTO projects (name) VALUES ('P')");
    const article = desktop.run('INSERT INTO articles (project_id, title) VALUES (?, ?)', project, 'A');
    desktop.pdfs.set(desktop.log.uuidOf('articles', article), new Uint8Array([37, 80, 68, 70]));
    const workspace = await pairedWorkspace();
    await workspace.syncNow();

    expect(await workspace.downloadPdf(1)).toBe(true);
    expect(Array.from((await workspace.reader.readPdf(1)) ?? [])).toEqual([37, 80, 68, 70]);
  });

  it('says false when the computer has no PDF for the article', async () => {
    const project = desktop.run("INSERT INTO projects (name) VALUES ('P')");
    desktop.run('INSERT INTO articles (project_id, title) VALUES (?, ?)', project, 'No PDF');
    const workspace = await pairedWorkspace();
    await workspace.syncNow();
    expect(await workspace.downloadPdf(1)).toBe(false);
  });

  it('tells what unpairing would lose, then forgets everything', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('P')");
    const workspace = await pairedWorkspace();
    await workspace.syncNow();
    await workspace.reader.writer.saveDiaryEntry(1, '2026-11-21', 'unsent');
    await workspace.reader.writer?.createProject?.('Mine');
    expect(workspace.lossesOnUnpair()).toEqual({ pendingChanges: 1, ownProjects: 1 });

    await workspace.unpair();

    expect(workspace.isPaired()).toBe(false);
    expect(await workspace.reader.listProjects()).toEqual([]);
    expect(storage.identity).toBeNull();
  });

  it('tells the screens when a sync starts and ends', async () => {
    const workspace = await pairedWorkspace();
    const seen: boolean[] = [];
    workspace.subscribe(() => seen.push(workspace.status().syncing));
    await workspace.syncNow();
    expect(seen).toEqual([true, false]);
  });

  it('keeps a PDF the person picked on the phone for an article of a project made here', async () => {
    const workspace = await LocalWorkspace.open(environment());
    const project = (await workspace.reader.writer?.createProject?.('Mine')) as number;
    const article = (await workspace.reader.writer?.addArticle?.(project, { title: 'Local' })) as number;

    await workspace.attachPdf(article, new Uint8Array([37, 80]));

    expect(await workspace.reader.pdfSize(article)).toBe(2);
    await expect(workspace.attachPdf(999, new Uint8Array(1))).rejects.toThrow('No article with id 999');
  });
});
