const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

const TITLES = ['Artigo alfa', 'Artigo beta', 'Artigo gama'];

async function addManualArticle(window, title) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
  await window.click('button[type="submit"]');
}

// Distinct vertical centres of the element's visible children: 1 means everything sits on one line.
// Centres, not tops: the bar centres controls of different heights (the 32px button beside 38px fields).
const lineCount = (locator) =>
  locator.evaluate((el) => {
    const centres = [...el.children]
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.width > 0)
      .map((rect) => Math.round(rect.top + rect.height / 2));
    return new Set(centres).size;
  });

test('filters show as chips in the result line and several articles are archived with one reason', async () => {
  test.setTimeout(120000);
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Filtros e seleção ' + Date.now());
    for (const title of TITLES) await addManualArticle(window, title);
    const table = window.getByTestId('main-articles-table');
    await expect(table.getByText('Artigo gama')).toBeVisible();

    // At 1000px with the sidebar open, the bar and the result line must not wrap.
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 850));
    const sidebar = window.getByRole('complementary', { name: 'Filtros' });
    await expect(sidebar).toBeVisible();
    await expect.poll(() => lineCount(window.locator('.filter-bar'))).toBe(1);

    // A filter becomes a chip with the count it leaves; the chip removes it again.
    await sidebar.getByRole('checkbox', { name: /^Com PDF,/ }).check();
    await expect(window.getByText('0 de 3 artigos')).toBeVisible();
    await expect.poll(() => lineCount(window.locator('.result-line'))).toBe(1);
    await window.getByRole('button', { name: 'Remover filtro Com PDF' }).click();
    await expect(window.getByText('3 artigos', { exact: true })).toBeVisible();

    // Multi-select: two articles, one archive reason for both.
    await window.getByRole('button', { name: 'Selecionar', exact: true }).click();
    await window.getByRole('checkbox', { name: 'Selecionar "Artigo alfa"' }).check();
    await window.getByRole('checkbox', { name: 'Selecionar "Artigo gama"' }).check();
    const batchBar = window.getByRole('region', { name: 'Ações para os artigos selecionados' });
    await expect(batchBar).toContainText('2 selecionados');
    await batchBar.getByRole('button', { name: /Arquivar/ }).click();
    await window.getByPlaceholder('Por que estes artigos não são relevantes?').fill('fora do escopo');
    await window.getByRole('button', { name: 'Arquivar 2' }).click();

    await expect(table.getByText('Artigo alfa')).toBeHidden();
    await expect(table.getByText('Artigo beta')).toBeVisible();
    await expect(batchBar).toContainText('Nenhum selecionado');
    await batchBar.getByRole('button', { name: 'Sair da seleção' }).click();
    await expect(window.getByText('1 artigo', { exact: true })).toBeVisible();

    // The status and the shared reason were saved: they survive a reload.
    await window.reload();
    const archived = window.getByText('Artigos Arquivados (2)');
    await expect(archived).toBeVisible({ timeout: 10000 });
    await archived.click();
    await expect(window.getByText('Motivo: fora do escopo')).toHaveCount(2);
  } finally {
    await electronApp.close();
  }
});
