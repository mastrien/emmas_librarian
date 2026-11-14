// Real SQLite and real archives in a temp folder: the previous suite mocked both services, so it only showed
// that a method with the same name was called. AdmZip reads back empty entries under jsdom, so this runs in node.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { SyncService } from '../SyncService';
import { appPathsIn } from '../../ports/AppPaths';
import { FakeAppRuntime } from '../../ports/__tests__/fakes/FakeAppRuntime';

let workDir: string;
let adapter: DatabaseAdapter;
let runtime: FakeAppRuntime;
let sync: SyncService;

const projectNames = () =>
  (adapter.getDB().prepare('SELECT name FROM projects ORDER BY id').all() as { name: string }[]).map((p) => p.name);
const addProject = (name: string) =>
  Number(adapter.getDB().prepare('INSERT INTO projects (name) VALUES (?)').run(name).lastInsertRowid);

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-syncservice-'));
  const paths = appPathsIn(path.join(workDir, 'userData'));
  fs.mkdirSync(paths.userData);
  adapter = new DatabaseAdapter(paths.dbPath);
  runtime = new FakeAppRuntime();
  sync = new SyncService(adapter, paths, runtime);
});

afterEach(() => {
  try {
    adapter.close();
  } catch {
    // A restore that replaces the library closes the database itself.
  }
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('SyncService', () => {
  it('exports a project to the given file and imports it back as a copy', async () => {
    const target = path.join(workDir, 'tese.emmapcarc');

    expect(await sync.exportProject(addProject('Tese'), target)).toBe(target);
    const imported = await sync.importProject(target);

    expect(imported).toBeGreaterThan(1);
    expect(projectNames()).toEqual(['Tese', 'Tese (Importado)']);
  });

  it('exports the whole library to the given file and merges only projects whose names are free', async () => {
    const target = path.join(workDir, 'tudo.emmabak');
    const kept = addProject('Fica');
    const removed = addProject('Some');

    expect(await sync.exportBackup(target)).toBe(target);
    adapter.getDB().prepare('DELETE FROM projects WHERE id = ?').run(removed);

    expect(await sync.restoreBackupMerge(target)).toBe(1);
    expect(projectNames().sort()).toEqual(['Fica', 'Some']);
    expect(kept).toBe(1);
  });

  it('replaces the library with the backup and asks the host to restart', async () => {
    const target = path.join(workDir, 'tudo.emmabak');
    addProject('Do backup');
    await sync.exportBackup(target);

    expect(await sync.restoreBackupOverride(target)).toBe(true);

    expect(runtime.restarts).toBe(1);
  });
});
