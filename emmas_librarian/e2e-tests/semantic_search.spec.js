const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

async function runSearchFlow(window, term) {
  await window.click('text="Nova busca"');
  await window.fill('input[placeholder="Termo de busca..."]', term);
  await window.click('button:has-text("Fazer Busca")');
  
  const summaryBtn = window.locator('button:has-text("Ver Artigos do Projeto")');
  await summaryBtn.waitFor({ state: 'visible', timeout: 10000 });
  await summaryBtn.click();
}

test('F-05 Semantic / relevance search via QueryBuilder', async () => {
  const electronApp = await launchApp({
    E2E_MOCK_SEARCH: 'true',
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Semantic Search Project ' + Date.now();
    await createProject(window, projectName);
    await runSearchFlow(window, 'aprendizado de maquina');

    const resultRow = window.locator('table >> text=Aprendizado de Maquina E2E');
    await expect(resultRow).toBeVisible({ timeout: 10000 });
  } finally {
    await electronApp.close();
  }
});
