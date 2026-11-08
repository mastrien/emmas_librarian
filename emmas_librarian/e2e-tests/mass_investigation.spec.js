const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption, answerAppDialog } = require('./helpers');

async function triggerImport(window) {
  window.on('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  await clickAddArticlesOption(window, 'Importar PDFs em Lote');
  await answerAppDialog(window, 'PDFs importados', 'Entendi');
}

// #73: without the app's side margins (12px kept at the edge), and with nothing spilling sideways.
async function expectEdgeToEdge(window) {
  const layout = await window.locator('.inv-page').evaluate((node) => {
    const box = node.getBoundingClientRect();
    const root = document.documentElement;
    return { left: box.left, right: root.clientWidth - box.right, spill: root.scrollWidth - root.clientWidth };
  });
  expect(layout.left).toBeCloseTo(12, 0);
  expect(layout.right).toBeCloseTo(12, 0);
  expect(layout.spill).toBeLessThanOrEqual(0);
}

test('Investigation page - Checkbox state persists across re-renders', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-pdf-'));
  const tempPdfPath = path.join(tempDir, 'E2E_Test_Article.pdf');
  fs.writeFileSync(tempPdfPath, 'PDF dummy content');

  const electronApp = await launchApp({
    E2E_MOCK_OPEN_MULTIPLE_FILES: tempPdfPath,
  });
  const window = await getFirstWindow(electronApp);

  try {
    // Wait for the app to fully settle to avoid race conditions on first launch
    await window.waitForTimeout(3000);
    const projectName = 'Massive Inv Project ' + Date.now();
    await createProject(window, projectName);

    // Import PDF to have an article with local_file_path
    await triggerImport(window);
    const articleRow = window.locator('table >> text=E2E_Test_Article');
    await expect(articleRow).toBeVisible({ timeout: 10000 });

    // Open the investigation page: a project with none opens on a new one.
    await window.getByRole('link', { name: 'Investigação com IA' }).click();
    const modal = window.locator('.inv-page');
    await expect(modal.getByRole('heading', { name: 'Nova investigação' })).toBeVisible({ timeout: 5000 });
    await expectEdgeToEdge(window);

    // Wait for ArticleSelector to render; the article checkbox is inside a <label>
    const articleCheckbox = modal.locator('label input[type="checkbox"]').first();
    await expect(articleCheckbox).toBeVisible({ timeout: 5000 });
    await expect(articleCheckbox).toBeChecked();

    // Uncheck the article
    await articleCheckbox.uncheck();
    await expect(articleCheckbox).not.toBeChecked();

    // Add a question, which causes state update in parent (aiQuestions) and re-renders AIExtractionModal
    const addQuestionBtn = modal.locator('button:has-text("+ Adicionar Pergunta")');
    await addQuestionBtn.click();

    // Verify checkbox is still unchecked after re-render (the original bug)
    await expect(articleCheckbox).not.toBeChecked();
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
