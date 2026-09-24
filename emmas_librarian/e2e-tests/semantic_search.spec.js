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
    await runSearch(window, 'aprendizado de maquina');

    // The summary reports what the (mocked) search saved before leaving the search page.
    const summaryBtn = window.locator('button:has-text("Ver Artigos do Projeto")');
    await summaryBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(window.locator('text=Salvos no Projeto').locator('..')).toContainText('1');
    await summaryBtn.click();

    const resultRow = window.locator('tr', { hasText: 'Aprendizado de Maquina E2E' });
    await expect(resultRow).toBeVisible({ timeout: 10000 });
    await expect(resultRow).toContainText('Author E2E');
    await expect(resultRow).toContainText('2026');
  } finally {
    await electronApp.close();
  }
});
