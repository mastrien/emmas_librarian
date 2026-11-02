const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

// #51: from an article with a DOI, the citations go through the search preview, enter the project and the history
// names them; on the PRISMA tab they are among the other methods, already tagged as citation searching.
test('explores the citations of an article and saves what it found', async () => {
  test.setTimeout(120000);
  const electronApp = await launchApp({ E2E_MOCK_SEARCH: 'true' });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Snowballing ' + Date.now());
    await clickAddArticlesOption(window, 'Artigo Manual');
    await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', 'Artigo de partida');
    await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
    await window.fill('input[placeholder="Ex: 10.1000/xyz123"]', '10.1000/partida');
    await window.click('button[type="submit"]');
    const table = window.getByTestId('main-articles-table');
    await expect(table.getByText('Artigo de partida')).toBeVisible();

    await table.locator('tr', { hasText: 'Artigo de partida' }).getByRole('button', { name: 'Mais ações' }).click();
    await window.getByRole('menuitem', { name: 'Explorar citações' }).click();

    const explore = window.getByRole('dialog', { name: 'Explorar citações' });
    await expect(explore.getByRole('status')).toContainText('São 1 trabalhos.');
    await explore.getByRole('button', { name: 'Buscar' }).click();

    const review = window.getByRole('dialog', { name: 'Busca Concluída' });
    await expect(review.getByRole('list', { name: 'Artigos encontrados' })).toContainText('Aprendizado de Maquina E2E');
    await review.getByRole('button', { name: /Salvar/ }).click();

    await expect(table.getByText('Aprendizado de Maquina E2E')).toBeVisible();

    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await window.getByRole('link', { name: 'Diagrama PRISMA' }).click();
    await expect(window.getByRole('button', { name: /Buscas por citações \(n = 1\)/ })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
