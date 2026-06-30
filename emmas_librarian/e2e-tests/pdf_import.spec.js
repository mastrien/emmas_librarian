const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

async function triggerImport(window) {
  window.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await window.click('button[title="Importar PDFs em Lote"]');
}

test('F-04 Import article via PDF', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-pdf-'));
  const tempPdfPath = path.join(tempDir, 'E2E_Import_Test_Article.pdf');
  fs.writeFileSync(tempPdfPath, 'PDF dummy content');

  const electronApp = await launchApp({
    E2E_MOCK_OPEN_MULTIPLE_FILES: tempPdfPath,
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'PDF Import Project ' + Date.now();
    await createProject(window, projectName);
    await triggerImport(window);

    const articleRow = window.locator('table >> text=E2E_Import_Test_Article');
    await expect(articleRow).toBeVisible({ timeout: 10000 });
  } finally {
    await electronApp.close();
    try {
      fs.unlinkSync(tempPdfPath);
      fs.rmdirSync(tempDir);
    } catch (e) {}
  }
});
