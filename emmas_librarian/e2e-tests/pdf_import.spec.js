const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

const PDF_CONTENT = 'PDF dummy content';

/** The PDFs the app stored in its (per-test, temporary) data folder. */
async function storedPdfs(electronApp) {
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'));
  const dir = path.join(userData, 'storage', 'pdfs');
  return fs.existsSync(dir) ? fs.readdirSync(dir).map((name) => path.join(dir, name)) : [];
}

test('F-04 Import article via PDF', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-pdf-'));
  const tempPdfPath = path.join(tempDir, 'E2E_Import_Test_Article.pdf');
  fs.writeFileSync(tempPdfPath, PDF_CONTENT);

  const electronApp = await launchApp({
    E2E_MOCK_OPEN_MULTIPLE_FILES: tempPdfPath,
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'PDF Import Project ' + Date.now();
    await createProject(window, projectName);

    const confirmation = window.waitForEvent('dialog');
    await clickAddArticlesOption(window, 'Importar PDFs em Lote');
    expect((await confirmation).message()).toBe('1 artigo(s) importado(s) com sucesso.');

    const articleRow = window.locator('table >> text=E2E_Import_Test_Article');
    await expect(articleRow).toBeVisible({ timeout: 10000 });

    // The article points at a copy inside the app's storage, not at the user's original file.
    const [stored] = await storedPdfs(electronApp);
    expect(stored).toBeDefined();
    expect(path.basename(stored)).toMatch(/E2E_Import_Test_Article\.pdf$/);
    expect(fs.readFileSync(stored, 'utf8')).toBe(PDF_CONTENT);
    expect(fs.existsSync(tempPdfPath)).toBe(true);
  } finally {
    await electronApp.close();
    try {
      fs.unlinkSync(tempPdfPath);
      fs.rmdirSync(tempDir);
    } catch {
      // Best-effort temp dir cleanup; leftovers do not affect the test.
    }
  }
});
