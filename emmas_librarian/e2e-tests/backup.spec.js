const { test, expect } = require('@playwright/test');
const AdmZip = require('adm-zip');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, getFirstWindow, createProject, navigateTo } = require('./helpers');

test('F-09 Trigger data backup creation', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-backup-'));
  const backupPath = path.join(tempDir, 'backup.emmabak');
  // The native save dialog cannot be driven from Playwright; the app writes to this path instead.
  const electronApp = await launchApp({ E2E_MOCK_SAVE_FILE_PATH: backupPath });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Backup Project ' + Date.now());
    await navigateTo(window, 'Configurações');

    // Awaiting the dialog (instead of asserting inside a handler) fails the test when no confirmation appears.
    const confirmation = window.waitForEvent('dialog');
    await window.click('button:has-text("Criar Backup Completo")');
    expect((await confirmation).message()).toBe(`Backup completo criado com sucesso em:\n${backupPath}`);

    // The archive is a real backup: the database plus metadata counting the project just created.
    const zip = new AdmZip(backupPath);
    expect(zip.getEntry('emma.db')).not.toBeNull();
    const metadata = JSON.parse(zip.getEntry('backup_metadata.json').getData().toString('utf8'));
    expect(metadata.projectCount).toBe(1);
    expect(metadata.articleCount).toBe(0);
  } finally {
    await electronApp.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
