const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

async function addManualArticle(window, title) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
  await window.click('button[type="submit"]');
}

async function pickLabel(window, title, label) {
  const row = window.getByTestId('review-row').filter({ hasText: title });
  await row.getByRole('button', { name: /Rótulo/ }).click();
  await row.getByRole('menuitem', { name: new RegExp(label) }).click();
}

// #49: the systematic review is a page of its own. Its only marks on the project page are the archived articles
// (with the label as reason) and, back the other way, restoring there takes the exclusion back.
test('screens articles on the review page and the guided screening, archiving exclusions in the project', async () => {
  test.setTimeout(150000);
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Triagem ' + Date.now());
    for (const title of ['Artigo alfa', 'Artigo beta', 'Artigo gama']) await addManualArticle(window, title);
    await expect(window.getByTestId('main-articles-table').getByText('Artigo gama')).toBeVisible();

    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await expect(window.getByRole('heading', { name: 'Revisão sistemática' })).toBeVisible();
    await pickLabel(window, 'Artigo alfa', 'Excluído');
    await expect(window.getByRole('status').filter({ hasText: 'arquivado no projeto' })).toBeVisible();
    await pickLabel(window, 'Artigo beta', 'Incluso');
    await expect(window.getByRole('region', { name: 'Incluso (1)' })).toContainText('Artigo beta');

    // The guided screening opens on the one article still undecided; "2" puts it in doubt and ends the stage.
    await window.getByRole('link', { name: /Iniciar triagem guiada/ }).click();
    await expect(window.getByRole('heading', { name: 'Artigo gama', level: 2 })).toBeVisible();
    await window.keyboard.press('2');
    await expect(window.getByRole('heading', { name: 'Triagem por título e resumo concluída' })).toBeVisible();

    // Decisions are in the database: they survive a reload of the review page.
    // The finished screen has its own "Voltar à revisão" besides the one in the header.
    await window.getByRole('link', { name: 'Voltar à revisão' }).last().click();
    await window.reload();
    const counts = window.getByRole('status', { name: 'Contagem da triagem' });
    await expect(counts).toContainText('1 incluídos', { timeout: 10000 });
    await expect(counts).toContainText('1 em dúvida');
    await expect(counts).toContainText('1 excluídos');

    // On the project page the exclusion is an archived article with the label as reason; restoring it there
    // brings it back to the review as undecided.
    await window.getByRole('link', { name: /Voltar ao projeto/ }).click();
    const archived = window.getByText('Artigos Arquivados (1)');
    await expect(archived).toBeVisible({ timeout: 10000 });
    await archived.click();
    await expect(window.getByText('Motivo: Excluído')).toBeVisible();
    await window.getByRole('button', { name: 'Restaurar' }).click();
    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await expect(window.getByTestId('review-row').filter({ hasText: 'Artigo alfa' })).toContainText('Rótulo');
    await expect(window.getByRole('status', { name: 'Contagem da triagem' })).toContainText('0 excluídos');
  } finally {
    await electronApp.close();
  }
});
