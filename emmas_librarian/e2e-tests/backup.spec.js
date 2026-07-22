const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, navigateTo } = require('./helpers');

async function mockBackupExport(window, mockPath) {
  await window.evaluate((path) => {
    const originalInvoke = window.electronAPI.invoke;
    window.electronAPI.invoke = async (channel, ...args) => {
      if (channel === 'backup:export') {
        return path;
      }
      return originalInvoke(channel, ...args);
    };
  }, mockPath);
}

async function triggerBackup(window) {
  window.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Backup completo criado com sucesso em');
    await dialog.accept();
  });

  await navigateTo(window, 'Configurações');
  await window.click('button:has-text("Criar Backup Completo")');
}

test('F-09 Trigger data backup creation', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    const mockBackupPath = 'C:\\mock\\backup.zip';
    await mockBackupExport(window, mockBackupPath);
    await triggerBackup(window);
  } finally {
    await electronApp.close();
  }
});
