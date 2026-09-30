const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');
const { copyFixturePdf, openReader } = require('./articleFixture');

async function addManualArticle(window, title, doi) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
  if (doi) await window.fill('input[placeholder="Ex: 10.1000/xyz123"]', doi);
  await window.click('button[type="submit"]');
}

// E2E_MOCK_OPEN_ACCESS_PDF: every OpenAlex lookup finds one repository copy that hands over the fixture PDF.
test('F-18 an open access PDF is found for one article and reported for a selection', async () => {
  test.setTimeout(120000);
  const fixture = copyFixturePdf();
  const electronApp = await launchApp({ E2E_MOCK_OPEN_ACCESS_PDF: fixture.pdfPath });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Acesso aberto ' + Date.now());
    await addManualArticle(window, 'Artigo aberto E2E', '10.1234/e2e-open');
    await addManualArticle(window, 'Relatório sem DOI', '');
    const table = window.getByTestId('main-articles-table');
    const row = (title) => table.locator('tr', { hasText: title });
    await expect(row('Relatório sem DOI')).toBeVisible();

    // One article: "Vincular PDF" → "Buscar PDF aberto" links the copy and the reader opens it.
    await row('Artigo aberto E2E').getByRole('button', { name: 'Vincular PDF' }).click();
    await window.getByRole('menuitem', { name: 'Buscar PDF aberto' }).click();
    await expect(row('Artigo aberto E2E')).toContainText('PDF baixado. Fonte: Repositório E2E.', { timeout: 15000 });
    await expect(row('Artigo aberto E2E').getByRole('link', { name: 'Ler' })).toBeVisible();

    // A selection: one already has the PDF, the other has no DOI to look it up.
    await window.getByRole('button', { name: 'Selecionar', exact: true }).click();
    const batchBar = window.getByRole('region', { name: 'Ações para os artigos selecionados' });
    await batchBar.getByRole('button', { name: 'Selecionar todos' }).click();
    await batchBar.getByRole('button', { name: /Baixar PDFs abertos/ }).click();
    const report = window.getByRole('dialog', { name: 'PDFs abertos: 0 de 2 baixados' });
    await expect(report).toBeVisible({ timeout: 15000 });
    await expect(report.getByRole('heading', { level: 4 })).toHaveText([
      'Sem cópia aberta ou sem DOI (1)',
      'Já tinham PDF (1)',
    ]);
    await report.getByRole('button', { name: 'Fechar' }).click();
    await batchBar.getByRole('button', { name: 'Sair da seleção' }).click();

    await openReader(window, 'Artigo aberto E2E');
  } finally {
    await electronApp.close();
    fixture.cleanup();
  }
});
