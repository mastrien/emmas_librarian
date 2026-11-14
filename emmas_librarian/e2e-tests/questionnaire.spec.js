const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption, answerAppDialog } = require('./helpers');

async function importPdf(window) {
  window.on('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  await clickAddArticlesOption(window, 'Importar PDFs em Lote');
  await answerAppDialog(window, 'PDFs importados', 'Entendi');
  await window.waitForSelector('table >> text=E2E_Import_Test_Article', { timeout: 10000 });
}

async function createQuestionSet(window, setName) {
  await window.getByRole('link', { name: 'Investigação com IA' }).click();
  await window.fill('input[placeholder="Pergunta 1"]', 'What is the main finding?');
  await window.click('button:has-text("+ Salvar Atual")');
  await window.fill('input[placeholder="Nome do conjunto"]', setName);
  await window.click('form button:has-text("Salvar")');
  await expect(window.locator(`.question-set-catalog >> text=${setName}`)).toBeVisible();
}

// The new investigation goes in steps (board 159): questions, articles, model, then the run.
async function runExtractionFlow(window) {
  await window.getByRole('button', { name: /Próximo: artigos/ }).click();
  await window.check('label:has-text("E2E_Import_Test_Article") input[type="checkbox"]');
  await window.getByRole('list', { name: 'Passos da investigação' }).getByRole('button', { name: 'Executar' }).click();
  await window.getByRole('button', { name: 'Iniciar investigação' }).click();
  // When the run ends the page opens what it saved.
  await expect(window.getByRole('heading', { name: /Investigação #\d+/ })).toBeVisible({ timeout: 10000 });
}

// Since the redesign (board 159) the investigations are listed under "Investigação com IA" in the project sidebar,
// after "+ Nova investigação"; the sidebar is also the way back to the articles.
async function verifyHistory(window) {
  await window.getByTestId('tab-articles').click();
  await window.getByRole('link', { name: 'Investigação com IA' }).click();
  await window
    .getByRole('navigation', { name: 'Investigações do projeto' })
    .getByRole('link', { name: /^#\d+/ })
    .first()
    .click();
  await expect(window.getByRole('heading', { name: /Investigação #\d+/ })).toBeVisible();
  await window.getByTestId('tab-articles').click();
}

test('F-07 Create and answer investigation questionnaire', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-rag-'));
  const tempPdfPath = path.join(tempDir, 'E2E_Import_Test_Article.pdf');
  fs.writeFileSync(tempPdfPath, 'PDF dummy content');

  const electronApp = await launchApp({
    E2E_MOCK_OPEN_MULTIPLE_FILES: tempPdfPath,
    E2E_MOCK_AI_EXTRACTION: 'true',
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Questionnaire Project ' + Date.now();
    await createProject(window, projectName);
    await importPdf(window);
    await createQuestionSet(window, 'E2E Question Set');
    await runExtractionFlow(window);
    await verifyHistory(window);
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
