const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

async function flow1CreateProject(window, projectName) {
  await createProject(window, projectName);
}

async function flow2UploadAndRead(window, articleTitle) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', articleTitle);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Emma Watson');
  await window.click('button[type="submit"]');

  // The title opens the details panel beside the table (board 153).
  await window.getByTestId('main-articles-table').getByRole('button', { name: articleTitle }).click();
  const details = window.getByRole('complementary', { name: 'Detalhes do artigo' });
  await expect(details.getByText('Emma Watson')).toBeVisible();

  await details.getByRole('button', { name: 'Fechar detalhes' }).click();
  await expect(details).toBeHidden();
}

async function flow3QueryBuilderSearch(window, searchTerm) {
  await window.click('text="Nova busca"');
  await window.fill('input[placeholder="Termo de busca..."]', searchTerm);
  await window.click('button:has-text("Fazer Busca")');

  const saveBtn = window.getByRole('button', { name: /Salvar .*no projeto/ });
  await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
  await saveBtn.click();

  const resultRow = window.locator('table >> text=Aprendizado de Maquina E2E');
  await expect(resultRow).toBeVisible({ timeout: 10000 });
}

test('Comprehensive E2E User Flows', async () => {
  const electronApp = await launchApp({
    E2E_MOCK_SEARCH: 'true',
  });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Playwright Test Project ' + Date.now();
    await flow1CreateProject(window, projectName);
    await flow2UploadAndRead(window, 'E2E Playwright Manual Article');
    await flow3QueryBuilderSearch(window, 'aprendizado de maquina');
  } finally {
    await electronApp.close();
  }
});
