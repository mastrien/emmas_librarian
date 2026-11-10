const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp, getFirstWindow, createProject, navigateTo, clickAddArticlesOption } = require('./helpers');

// Helper to create a unique dummy PDF file for each test run to ensure strict test isolation
function createDummyPdf() {
  const uniqueId = Date.now();
  const filename = `E2E_Sharing_Test_${uniqueId}.pdf`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-sharing-'));
  const tempPdfPath = path.join(tempDir, filename);
  fs.writeFileSync(tempPdfPath, `PDF dummy content for sharing test ${uniqueId}`);
  return { tempDir, tempPdfPath, filename };
}

// Clean up helper for temp files
function cleanTempPdf(tempPdfPath, tempDir) {
  try {
    fs.unlinkSync(tempPdfPath);
    fs.rmdirSync(tempDir);
  } catch {
    // Ignore cleanup errors
  }
}

test('F-15 Cross-project Article Sharing and Search History Traceability', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    // 1. Create Source Project (Project A)
    const sourceProjectName = 'Source Project ' + Date.now();
    await createProject(window, sourceProjectName);

    // 2. Add an article manually in Project A
    await clickAddArticlesOption(window, 'Artigo Manual');
    await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', 'Article from Project A');
    await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Author A');
    await window.click('button[type="submit"]');
    await window.waitForSelector('table >> text=Article from Project A');

    // Go back to Projects list
    await navigateTo(window, 'Projetos');
    await window.waitForSelector('text="Novo Projeto"');

    // 3. Create Destination Project (Project B)
    const destProjectName = 'Destination Project ' + Date.now();
    await createProject(window, destProjectName);

    // 4. Click "Importar de outro projeto" to open sharing modal
    await clickAddArticlesOption(window, 'Importar de outro projeto');
    await expect(window.getByRole('dialog', { name: 'Importar Artigos de Outro Projeto' })).toBeVisible();

    // 5. Select Source Project in the dropdown
    await window.waitForSelector(`select[id="source-project-select"] option:has-text("${sourceProjectName}")`, {
      state: 'attached',
      timeout: 10000,
    });
    await window.selectOption('select[id="source-project-select"]', { label: sourceProjectName });

    // Wait for articles to load — partial regex match for "{count} artigos encontrados"
    await window.waitForSelector('text=/artigos encontrados/', { timeout: 10000 });

    // 6. Check the article in the list and click Import
    await window.click('input[type="checkbox"][id="select-all-articles"]');

    // Verify at least one article is selected before clicking import
    await window.waitForSelector('text=/selecionado\\(s\\) para cópia/', { timeout: 5000 });

    await window.click('button:has-text("Confirmar Importação")');

    // 7. Verify article is present in Destination Project B
    const articleRow = window.locator('table >> text=Article from Project A');
    await expect(articleRow).toBeVisible({ timeout: 15000 });

    // 8. Go to Search History tab and verify history record with correct Search ID
    await window.getByTestId('tab-history').click();
    // Board 157: the inclusion is listed by what it recorded, and opens beside the list.
    const historyList = window.getByRole('navigation', { name: 'Buscas do projeto' });
    await expect(historyList.getByRole('button', { name: /Importação de artigos/ })).toBeVisible();
    await expect(window.getByRole('heading', { level: 2, name: /Importação de artigos/ })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('F-16 Global PDF Library and Deduplicated Reuse', async () => {
  const { tempDir, tempPdfPath, filename: pdfFilename } = createDummyPdf();

  // Mocking the open file dialogue env to return our unique dummy PDF path
  const electronApp = await launchApp({
    E2E_MOCK_OPEN_FILE: tempPdfPath,
  });
  const window = await getFirstWindow(electronApp);

  try {
    // 1. Create Project A and link PDF
    const projAName = 'PDF Library Proj A ' + Date.now();
    await createProject(window, projAName);

    await clickAddArticlesOption(window, 'Artigo Manual');
    await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', 'Article with PDF A');
    await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Author A');
    await window.click('button[type="submit"]');

    // Wait for article to appear in the table before interacting
    await window.waitForSelector('text="Article with PDF A"', { timeout: 10000 });

    // Upload PDF for Article A — from the details panel (board 153)
    const details = window.getByRole('complementary', { name: 'Detalhes do artigo' });
    await window.getByTestId('main-articles-table').getByRole('button', { name: 'Article with PDF A' }).click();
    await details.getByRole('button', { name: /Vincular PDF/ }).click();
    await window.waitForSelector('button:has-text("Upload do Computador")', { timeout: 5000 });
    await window.click('button:has-text("Upload do Computador")');
    await expect(details.getByRole('link', { name: /Ler PDF/ })).toBeVisible({ timeout: 10000 });
    await details.getByRole('button', { name: 'Fechar detalhes' }).click();

    // 2. Go to PDF Library Page
    await navigateTo(window, 'Biblioteca de PDFs');
    await expect(window.locator('h1:has-text("Biblioteca Global de PDFs")')).toBeVisible({ timeout: 5000 });

    // Verify PDF is registered in Library — target the unique filename row
    const pdfRow = window.locator(`tr:has-text("${pdfFilename}")`).first();
    await expect(pdfRow).toBeVisible({ timeout: 10000 });
    await expect(pdfRow.locator('text=Utilizado em 1 artigo')).toBeVisible({ timeout: 10000 });

    // The link dialog's overlay must cover the whole window. A transform left on <main> by the
    // fade-in animation used to make <main> its containing block, pushing the dialog off-screen.
    // Since Arca 134 the dialog is the shared Modal: the overlay is its backdrop, the dialog the box inside.
    await pdfRow.getByTitle('Vincular a outro Artigo').click();
    const linkDialog = window.getByRole('dialog', { name: 'Vincular PDF a um Artigo' });
    await expect(linkDialog).toBeVisible();
    const overlayBox = await window.getByTestId('app-modal-overlay').boundingBox();
    const viewport = await window.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    expect(overlayBox).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    await linkDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(linkDialog).toBeHidden();

    // 3. Create Project B and reuse the same PDF
    await navigateTo(window, 'Projetos');
    await window.waitForSelector('text="Novo Projeto"');
    const projBName = 'PDF Library Proj B ' + Date.now();
    await createProject(window, projBName);

    await clickAddArticlesOption(window, 'Artigo Manual');
    await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', 'Article with PDF B');
    await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Author B');
    await window.click('button[type="submit"]');

    // Wait for article to appear before interacting
    await window.waitForSelector('text="Article with PDF B"', { timeout: 10000 });

    // Link existing PDF from Library to Article B
    await window.getByTestId('main-articles-table').getByRole('button', { name: 'Article with PDF B' }).click();
    await details.getByRole('button', { name: /Vincular PDF/ }).click();
    await window.waitForSelector('button:has-text("Selecionar da Biblioteca")', { timeout: 5000 });
    await window.click('button:has-text("Selecionar da Biblioteca")');

    // Choose PDF from list modal — select the specific unique PDF item's link button (AttachPdfModal renders divs, not trs)
    await window.waitForSelector(`div:has-text("${pdfFilename}") button[title="Vincular este PDF"]`, {
      timeout: 10000,
    });
    await window.click(`div:has-text("${pdfFilename}") button[title="Vincular este PDF"]`);
    await expect(details.getByRole('link', { name: /Ler PDF/ })).toBeVisible({ timeout: 10000 });
    await details.getByRole('button', { name: 'Fechar detalhes' }).click();

    // 4. Return to PDF Library and verify reference count is 2 (scoped to unique pdfRow)
    await navigateTo(window, 'Biblioteca de PDFs');
    const pdfRowUpdated = window.locator(`tr:has-text("${pdfFilename}")`).first();
    await expect(pdfRowUpdated.locator('text=Utilizado em 2 artigos')).toBeVisible({ timeout: 10000 });
  } finally {
    await electronApp.close();
    cleanTempPdf(tempPdfPath, tempDir);
  }
});
