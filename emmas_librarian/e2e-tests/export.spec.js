const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

async function addManualArticle(window, title) {
  await window.click('button:has-text("Manual")');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Emma Watson');
  await window.click('button[type="submit"]');
}

test('F-06 Export bibliographic references to CSV', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-export-'));
  const tempCsvPath = path.join(tempDir, 'export.csv');

  const electronApp = await launchApp({
    E2E_MOCK_SAVE_FILE_PATH: tempCsvPath,
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Export Project ' + Date.now();
    await createProject(window, projectName);
    await addManualArticle(window, 'Export E2E Test Article');

    // Select Categorias tab to reveal the Exportar CSV button
    await window.click('text="Categorias"');

    // Click Export CSV button
    await window.click('button:has-text("Exportar CSV")');

    // Wait for file to be written
    let content = '';
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(tempCsvPath)) {
        content = fs.readFileSync(tempCsvPath, 'utf8');
        if (content.length > 0) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    expect(content).toContain('Export E2E Test Article');
    expect(content).toContain('Emma Watson');
  } finally {
    await electronApp.close();
    try {
      fs.unlinkSync(tempCsvPath);
      fs.rmdirSync(tempDir);
    } catch (e) {}
  }
});
