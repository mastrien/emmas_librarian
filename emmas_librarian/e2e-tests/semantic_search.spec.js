const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

async function runSearch(window, term) {
  await window.click('text="Nova busca"');
  await window.fill('input[placeholder="Termo de busca..."]', term);
  await window.click('button:has-text("Fazer Busca")');
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
    await review.getByRole('button', { name: /Descartar/ }).click();
    await expect(review).toBeHidden();
    await window.click('text="Voltar para o Projeto"');
    await expect(window.getByText('Nova busca')).toBeVisible();
    await expect(resultRow).toHaveCount(0);

    await runSearch(window, 'aprendizado de maquina');
    await review.getByRole('button', { name: /Salvar no projeto/ }).click();

    await expect(resultRow).toBeVisible({ timeout: 10000 });
    await expect(resultRow).toContainText('Author E2E');
    await expect(resultRow).toContainText('2026');
  } finally {
    await electronApp.close();
  }
});
