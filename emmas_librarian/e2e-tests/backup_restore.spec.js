const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, getFirstWindow, createProject, navigateTo } = require('./helpers');
const { IMPORTED_TITLE, copyFixturePdf, importFixturePdf, openReader } = require('./articleFixture');

/** A temp folder the spec owns: app data folders (kept across relaunches) and the backup file. */
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-restore-'));
  const dir = (name) => fs.mkdirSync(path.join(root, name), { recursive: true }) && path.join(root, name);
  return {
    root,
    dir,
    backup: path.join(root, 'biblioteca.emmabak'),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

async function clickAndReadAlert(window, buttonName) {
  const alert = window.waitForEvent('dialog');
  await window.getByRole('button', { name: buttonName }).click();
  return (await alert).message();
}

/** Creates a project with the fixture article (and its stored PDF), then writes a full backup. */
async function createLibraryAndBackup(env, userDataDir, projectName) {
  const app = await launchApp(env, { userDataDir });
  const window = await getFirstWindow(app);
  await createProject(window, projectName);
  await importFixturePdf(window);
  await navigateTo(window, 'Configurações');
  expect(await clickAndReadAlert(window, 'Criar Backup Completo')).toContain('Backup completo criado com sucesso');
  return { app, window };
}

async function expectProjectWithReadablePdf(window, projectName) {
  await navigateTo(window, 'Projetos');
  await window.getByText(projectName, { exact: true }).click();
  await expect(window.locator('table').getByText(IMPORTED_TITLE)).toBeVisible({ timeout: 10000 });
  await openReader(window);
}

test.describe('Full backup restore', () => {
  // Each test launches the app twice (backup side and restore side) and imports a PDF.
  test.setTimeout(180000);

  test('F-12 "Restaurar e Sobrescrever" brings back the backed-up library, including stored PDFs', async () => {
    const ws = workspace();
    const fixture = copyFixturePdf();
    const dataDir = ws.dir('app-data');
    const env = {
      E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath,
      E2E_MOCK_SAVE_FILE_PATH: ws.backup,
      E2E_MOCK_BACKUP_FILE: ws.backup,
    };
    try {
      const { app, window } = await createLibraryAndBackup(env, dataDir, 'Projeto do Backup');

      // Diverge from the backup: a new project, and the stored PDF lost from disk.
      await createProject(window, 'Projeto Posterior');
      fs.rmSync(path.join(dataDir, 'storage', 'pdfs'), { recursive: true, force: true });
      await navigateTo(window, 'Configurações');
      const exited = app.waitForEvent('close');
      // Confirming the "SOBRESCREVER" warning restores and exits (relaunch is left to the test under E2E).
      await window.getByRole('button', { name: 'Restaurar e Sobrescrever' }).click();
      await exited;

      const relaunched = await launchApp(env, { userDataDir: dataDir });
      try {
        const restored = await getFirstWindow(relaunched);
        await navigateTo(restored, 'Projetos');
        await expect(restored.getByText('Projeto do Backup', { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(restored.getByText('Projeto Posterior', { exact: true })).toHaveCount(0);
        await expectProjectWithReadablePdf(restored, 'Projeto do Backup');
      } finally {
        await relaunched.close();
      }
    } finally {
      fixture.cleanup();
      ws.cleanup();
    }
  });

  test('F-13 "Importar e Mesclar" adds the backup projects to another library once', async () => {
    const ws = workspace();
    const fixture = copyFixturePdf();
    const env = {
      E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath,
      E2E_MOCK_SAVE_FILE_PATH: ws.backup,
      E2E_MOCK_BACKUP_FILE: ws.backup,
    };
    try {
      const source = await createLibraryAndBackup(env, ws.dir('source-data'), 'Projeto de Outro Computador');
      await source.app.close();

      const app = await launchApp(env, { userDataDir: ws.dir('target-data') });
      try {
        const window = await getFirstWindow(app);
        await createProject(window, 'Projeto Local');
        await navigateTo(window, 'Configurações');

        expect(await clickAndReadAlert(window, 'Importar e Mesclar')).toBe(
          '1 projetos novos foram importados e mesclados com sucesso!',
        );
        await navigateTo(window, 'Projetos');
        await expect(window.getByText('Projeto Local', { exact: true })).toBeVisible();
        await expectProjectWithReadablePdf(window, 'Projeto de Outro Computador');

        // Merging the same backup again must not duplicate the project. (The reader is full screen: leave it first.)
        await window.goBack();
        await window.waitForURL(/\/projects\/\d+/);
        await navigateTo(window, 'Configurações');
        expect(await clickAndReadAlert(window, 'Importar e Mesclar')).toMatch(/^Nenhum projeto novo encontrado/);
      } finally {
        await app.close();
      }
    } finally {
      fixture.cleanup();
      ws.cleanup();
    }
  });
});
