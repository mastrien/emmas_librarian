const { _electron: electron } = require('playwright');
const path = require('path');
const { test, expect } = require('@playwright/test');

async function launchApp() {
  const mainPath = path.resolve(__dirname, '../dist-electron/electron/main.js');
  const electronApp = await electron.launch({
    args: [mainPath, '--headless'],
  });
  return electronApp;
}

async function getFirstWindow(electronApp) {
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return window;
}

async function flow1CreateProject(window, projectName) {
  await window.click('text="Novo Projeto"');
  await window.fill('input[placeholder="Ex: Sistemas de Recomendação na Educação"]', projectName);
  await window.click('button[type="submit"]');
  await window.waitForURL(/.*\/projects\/\d+/);
}

async function flow2UploadAndRead(window, articleTitle) {
  await window.click('button:has-text("Manual")');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', articleTitle);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Emma Watson');
  await window.click('button[type="submit"]');

  await window.click(`text="${articleTitle}"`);
  const titleHeader = window.locator('h3', { hasText: 'Detalhes do Artigo' });
  await expect(titleHeader).toBeVisible();
}

async function flow3QueryBuilderSearch(window, searchTerm) {
  await window.click('text="Busca"');
  await window.fill('input[placeholder="Termo de busca..."]', searchTerm);
  await window.click('button:has-text("Buscar")');
  const resultRow = window.locator('table >> text=' + searchTerm);
  await expect(resultRow).toBeVisible();
}

test('Comprehensive E2E User Flows', async () => {
  const isHeadless = process.env.HEADLESS_E2E === 'true' || process.env.CI === 'true' || !!process.env.ANTIGRAVITY_AGENT;
  if (isHeadless) {
    throw new Error('Erro de Ambiente: Os testes E2E do Electron exigem um servidor de exibição gráfica (GUI) ativo (ou framebuffer virtual Xvfb em Linux/CI) para instanciar BrowserWindow. Execução interrompida de forma diagnóstica para evitar timeout.');
  }
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Playwright Test Project ' + Date.now();
    await flow1CreateProject(window, projectName);
    await flow2UploadAndRead(window, 'E2E Playwright Manual Article');
    await flow3QueryBuilderSearch(window, 'E2E Playwright Manual Article');
  } finally {
    await electronApp.close();
  }
});
