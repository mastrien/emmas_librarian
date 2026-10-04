const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { launchApp, getFirstWindow, createProject, navigateTo } = require('./helpers');

/**
 * Recovery after an update, through the real main process (main.ts and preload are not covered by unit
 * tests). There is no update server under E2E, so the spec writes what an update leaves behind itself:
 * the gzipped pre-update snapshot and update_state.json, in the same shape UpdateSafetyService writes them.
 */
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-update-recovery-'));
  const dataDir = path.join(root, 'app-data');
  fs.mkdirSync(dataDir);
  return {
    dataDir,
    dbPath: path.join(dataDir, 'emma.db'),
    backupsDir: path.join(dataDir, 'backups'),
    statePath: path.join(dataDir, 'update_state.json'),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

/** Launches on the workspace, creates a project, and returns the running version; the app is closed after. */
async function createLibraryWithProject(ws, projectName) {
  const app = await launchApp({}, { userDataDir: ws.dataDir });
  try {
    const window = await getFirstWindow(app);
    await createProject(window, projectName);
    return await app.evaluate(({ app: electronApp }) => electronApp.getVersion());
  } finally {
    await app.close();
  }
}

function takePreUpdateSnapshot(ws) {
  // The app checkpoints the WAL on close; a leftover WAL would mean the snapshot misses rows.
  expect(fs.existsSync(`${ws.dbPath}-wal`) && fs.statSync(`${ws.dbPath}-wal`).size > 0).toBe(false);
  fs.mkdirSync(ws.backupsDir, { recursive: true });
  const snapshotPath = path.join(ws.backupsDir, 'pre_update_0.0.1_1000000000000.db.gz');
  fs.writeFileSync(snapshotPath, zlib.gzipSync(fs.readFileSync(ws.dbPath)));
  return snapshotPath;
}

function recordUpdate(ws, { status, targetVersion, snapshotPath }) {
  const state = { status, fromVersion: '0.0.1', targetVersion, snapshotPath, timestamp: 1000000000000 };
  fs.writeFileSync(ws.statePath, JSON.stringify(state, null, 2));
}

const readState = (ws) => JSON.parse(fs.readFileSync(ws.statePath, 'utf-8'));
const preRestoreCopies = (ws) => fs.readdirSync(ws.backupsDir).filter((name) => /^pre_restore_\d+\.db\.gz$/.test(name));

/** Collects the main process stdout, where the E2E recovery mock reports each box it answered. */
function captureStdout(app) {
  let output = '';
  app.process().stdout.on('data', (chunk) => (output += chunk.toString()));
  return () => output;
}

async function expectProjects(ws, { present, absent }) {
  const app = await launchApp({}, { userDataDir: ws.dataDir });
  try {
    const window = await getFirstWindow(app);
    await navigateTo(window, 'Projetos');
    await expect(window.getByText(present, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(window.getByText(absent, { exact: true })).toHaveCount(0);
  } finally {
    await app.close();
  }
}

test.describe('Recovery after an update', () => {
  // Three to four launches per test.
  test.setTimeout(180000);

  test('U-01 a library the new version cannot open is restored from the pre-update snapshot', async () => {
    const ws = workspace();
    try {
      const version = await createLibraryWithProject(ws, 'Antes da Atualização');
      const snapshotPath = takePreUpdateSnapshot(ws);
      recordUpdate(ws, { status: 'pending_verification', targetVersion: version, snapshotPath });
      // What the failed update left: a file SQLite refuses to open.
      const broken = Buffer.from('not a sqlite database, written by a failed update');
      fs.writeFileSync(ws.dbPath, broken);

      const app = await launchApp({ E2E_MOCK_RECOVERY_CHOICE: '0' }, { userDataDir: ws.dataDir });
      const stdout = captureStdout(app);
      // Choice 0 = "Restaurar Dados Anteriores": restore, confirm, quit; no window is ever opened.
      await app.waitForEvent('close');

      expect(stdout()).toContain("[E2E recovery dialog] Emma's Librarian - Erro de Atualização");
      expect(stdout()).toContain('[E2E recovery dialog] Restauração Concluída');
      expect(readState(ws)).toMatchObject({ status: 'failed', rolledBack: true });
      const [copy] = preRestoreCopies(ws);
      expect(zlib.gunzipSync(fs.readFileSync(path.join(ws.backupsDir, copy)))).toEqual(broken);
      await expectProjects(ws, { present: 'Antes da Atualização', absent: 'nunca existiu' });
    } finally {
      ws.cleanup();
    }
  });

  test('U-02 "Restaurar Dados do Snapshot" in Settings brings back the library from before the update', async () => {
    const ws = workspace();
    try {
      const version = await createLibraryWithProject(ws, 'Antes da Atualização');
      const snapshotPath = takePreUpdateSnapshot(ws);
      recordUpdate(ws, { status: 'verified', targetVersion: version, snapshotPath });

      const app = await launchApp({}, { userDataDir: ws.dataDir });
      const window = await getFirstWindow(app);
      await createProject(window, 'Depois da Atualização');
      await navigateTo(window, 'Configurações');
      const exited = app.waitForEvent('close');
      // getFirstWindow accepts the confirm(); the restore then exits (relaunch is left to the test under E2E).
      await window.getByRole('button', { name: 'Restaurar Dados do Snapshot Pré-Atualização' }).click();
      await exited;

      expect(readState(ws)).toMatchObject({ status: 'failed', rolledBack: true });
      const [copy] = preRestoreCopies(ws);
      // The replaced library is kept: its pages still hold the project created after the update.
      expect(zlib.gunzipSync(fs.readFileSync(path.join(ws.backupsDir, copy))).includes('Depois da Atualização')).toBe(
        true,
      );
      await expectProjects(ws, { present: 'Antes da Atualização', absent: 'Depois da Atualização' });
    } finally {
      ws.cleanup();
    }
  });
});
