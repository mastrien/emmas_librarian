import path from 'path';
import { vi, expect } from 'vitest';
import { FakeIpcMain } from './FakeIpcMain';
import { FakeFileSystem } from './FakeFileSystem';
import { createRecordingDouble } from './RecordingDouble';

/**
 * Shared fakes for testing `setupIpcRegistries` through its public contract
 * (handlers registered on ipcMain). Each test file wires them in with
 * `vi.mock(<module>, () => import('./fakes/ipcHarness').then((h) => h.<x>Module))`
 * and calls `resetIpcHarness()` + `setupIpcRegistries()` in `beforeEach`.
 *
 * Usage:
 *   harness.db.getProject.mockReturnValue(project);
 *   await invoke(IpcChannel.EXPORT_CSV, 1);
 */
export const USER_DATA = path.join(path.sep, 'userdata');
export const PDF_DIR = path.join(USER_DATA, 'storage', 'pdfs');
export const DOCS_DIR = path.join(USER_DATA, 'storage', 'project_documents');

export const harness = {
  ipcMain: new FakeIpcMain(),
  disk: new FakeFileSystem(),
  db: createRecordingDouble(),
  sqlite: createRecordingDouble(),
  backup: createRecordingDouble(),
  orchestrator: createRecordingDouble(),
  translator: createRecordingDouble(),
  exporter: createRecordingDouble(),
  ai: createRecordingDouble(),
  sync: createRecordingDouble(),
  venues: createRecordingDouble(),
  app: { getPath: vi.fn(), getVersion: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  windows: { fromWebContents: vi.fn() },
};

type Constructor = new (...args: unknown[]) => object;

function constructing(instance: object): Constructor {
  // A constructor that returns an object makes `new` yield that object.
  return function FakeConstructor() {
    return instance;
  } as unknown as Constructor;
}

const { disk } = harness;
const fsFacade = {
  existsSync: disk.existsSync,
  mkdirSync: disk.mkdirSync,
  readFileSync: disk.readFileSync,
  writeFileSync: disk.writeFileSync,
  copyFileSync: disk.copyFileSync,
  unlinkSync: disk.unlinkSync,
  statSync: disk.statSync,
};

export const electronModule = {
  ipcMain: harness.ipcMain,
  app: harness.app,
  dialog: harness.dialog,
  shell: harness.shell,
  BrowserWindow: harness.windows,
};
export const fsModule = { default: fsFacade, ...fsFacade };
export const databaseAdapterModule = { DatabaseAdapter: constructing(harness.db) };
export const venueRepositoryModule = { ScientificVenueRepository: constructing(harness.venues) };
export const searchOrchestratorModule = { SearchOrchestrator: constructing(harness.orchestrator) };
export const queryTranslatorModule = { QueryTranslator: constructing(harness.translator), queryTranslator: harness.translator };
export const apiIntegratorModule = { ApiIntegrator: constructing(createRecordingDouble()) };
export const exportServiceModule = { ExportService: constructing(harness.exporter) };
export const aiServiceModule = { AIService: constructing(harness.ai) };
export const syncServiceModule = { SyncService: constructing(harness.sync) };
export const backupServiceModule = { BackupService: constructing(harness.backup) };

const doubles = [harness.db, harness.sqlite, harness.backup, harness.orchestrator, harness.translator];
const moreDoubles = [harness.exporter, harness.ai, harness.sync, harness.venues];
const plainMocks = [harness.app, harness.dialog, harness.shell, harness.windows].flatMap((group) => Object.values(group));

export function resetIpcHarness(): void {
  harness.ipcMain.reset();
  disk.reset();
  [...doubles, ...moreDoubles].forEach((double) => double.reset());
  plainMocks.forEach((mock) => mock.mockReset());
  harness.app.getPath.mockReturnValue(USER_DATA);
  harness.app.getVersion.mockReturnValue('9.9.9');
  harness.db.getDB.mockReturnValue(harness.sqlite);
}

export function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return harness.ipcMain.invoke(channel, ...args);
}

/** Awaits a handler expected to fail and returns the AppError payload the renderer receives. */
export async function rejectionPayload(pending: Promise<unknown>): Promise<{ code: string; type: string; message: string }> {
  const error = await pending.then(
    () => expect.unreachable('handler should have rejected'),
    (e: unknown) => e,
  );
  return JSON.parse((error as Error).message);
}

/** Lets fire-and-forget startup work (auto backup) run before asserting on it. */
export function flushStartupTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
