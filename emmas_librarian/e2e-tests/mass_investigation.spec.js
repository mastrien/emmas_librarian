const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

async function triggerImport(window) {
  window.on('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  await clickAddArticlesOption(window, 'Importar PDFs em Lote');
}

test('Massive Investigation Modal - Checkbox state persists across re-renders', async () => {
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

    // Open AI Extraction Modal
    const massiveInvBtn = window.locator('button').filter({ hasText: /Extra.*IA/ }).first();
    await massiveInvBtn.click();

    // Scope all interactions to the modal container to avoid matching
    // page-level checkboxes (e.g. "Apenas com PDF vinculado" filter)
    const modal = window.locator('[data-testid="ai-extraction-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify modal title rendered
    const modalTitle = modal.locator('h3').filter({ hasText: /Investiga.*Massiva com IA/ });
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

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
    } catch (e) {}
  }
});
