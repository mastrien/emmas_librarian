const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

async function runSearch(window, term, setLimits = async () => {}) {
  await window.click('text="Nova busca"');
  await window.fill('input[placeholder="Termo de busca..."]', term);
  await setLimits();
  await window.click('button:has-text("Fazer Busca")');
}

// A limit above a base's ceiling blocks the search; then a common value with one per-base adjustment.
async function chooseLimits(window) {
  const common = window.getByLabel('Máximo de resultados por base');
  const searchButton = window.getByRole('button', { name: /Fazer Busca/ });
  await common.fill('20000');
  await expect(window.getByRole('alert')).toContainText('OpenAlex aceita até 10.000 resultados');
  await expect(searchButton).toBeDisabled();
  await common.fill('1500');
  await window.getByText('Ajustar por base').click();
  await window.getByLabel('Crossref', { exact: true }).fill('300');
  await expect(window.getByLabel('Resultados pedidos a cada base')).toHaveText('OpenAlex 1.500 · Crossref 300');
  await expect(searchButton).toBeEnabled();
}

test('F-05 Semantic / relevance search via QueryBuilder', async () => {
  const electronApp = await launchApp({
    E2E_MOCK_SEARCH: 'true',
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Semantic Search Project ' + Date.now();
    await createProject(window, projectName);
    const resultRow = window.locator('tr', { hasText: 'Aprendizado de Maquina E2E' });
    const review = window.getByRole('dialog', { name: 'Busca Concluída' });

    // Nothing is saved until the user chooses: discarding leaves the project untouched.
    await runSearch(window, 'aprendizado de maquina');
    await expect(review.getByRole('list', { name: 'Artigos encontrados' })).toContainText(
      'Aprendizado de Maquina E2E',
      { timeout: 10000 },
    );
    // A title opens that result's metadata without leaving the review.
    await review.getByRole('button', { name: 'Aprendizado de Maquina E2E' }).click();
    await expect(window.getByText('10.1234/e2e-mock-doi')).toBeVisible();
    await window.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(window.getByText('10.1234/e2e-mock-doi')).toBeHidden();

    await review.getByRole('button', { name: /Descartar/ }).click();
    await expect(review).toBeHidden();
    await window.click('text="Voltar para o Projeto"');
    await expect(window.getByText('Nova busca')).toBeVisible();
    await expect(resultRow).toHaveCount(0);

    await runSearch(window, 'aprendizado de maquina', () => chooseLimits(window));
    await review.getByRole('button', { name: /Salvar .*no projeto/ }).click();

    await expect(resultRow).toBeVisible({ timeout: 10000 });
    await expect(resultRow).toContainText('Author E2E');
    await expect(resultRow).toContainText('2026');

    // The table follows its own width: with the filters sidebar open (the default) there is no room
    // for an authors column, so the authors move into the article cell; closing the sidebar brings it back.
    const authorsHeader = window.getByRole('columnheader', { name: 'AUTORES' });
    await expect(authorsHeader).toBeHidden();
    await window.getByRole('button', { name: /^Filtros/ }).click();
    await expect(authorsHeader).toBeVisible();

    // The history records what was asked of each base and what came back (traceability).
    await window.getByTestId('tab-history').click();
    await expect(window.getByText('1.500 por base (Crossref 300)')).toBeVisible();
    await expect(window.getByText('Únicos entre as bases: 1')).toBeVisible();

    // The saved search can be reopened in the query builder from the history, limits included.
    await window
      .getByRole('link', { name: /Nova busca a partir desta/ })
      .first()
      .click();
    await expect(window.getByRole('status')).toContainText('carregada do histórico');
    await expect(window.locator('input[placeholder="Termo de busca..."]')).toHaveValue('aprendizado de maquina');
    await expect(window.getByLabel('Máximo de resultados por base')).toHaveValue('1500');
    await expect(window.getByLabel('Crossref', { exact: true })).toHaveValue('300');
  } finally {
    await electronApp.close();
  }
});
