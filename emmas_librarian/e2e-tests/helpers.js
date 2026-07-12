const { _electron: electron } = require('playwright');
const path = require('path');

function checkHeadless() {
  const isHeadless =
    process.env.HEADLESS_E2E === 'true' || process.env.CI === 'true' || !!process.env.ANTIGRAVITY_AGENT;
  if (isHeadless) {
    throw new Error(
      'Erro de Ambiente: Os testes E2E do Electron exigem um servidor de exibição gráfica (GUI) ativo (ou framebuffer virtual Xvfb em Linux/CI) para instanciar BrowserWindow. Execução interrompida de forma diagnóstica para evitar timeout.',
    );
  }
}

async function launchApp(env = {}) {
  checkHeadless();
  const mainPath = path.resolve(__dirname, '../dist-electron/electron/main.js');
  const electronApp = await electron.launch({
    args: [mainPath],
    env: { ...process.env, ...env },
  });
  return electronApp;
}

async function dismissChangelog(window) {
  try {
    const changelogBtn = window.locator('button:has-text("Entendido, vamos lá!")');
    await changelogBtn.waitFor({ state: 'visible', timeout: 2000 });
    await changelogBtn.click();
  } catch (e) {
    // Changelog modal not shown
  }
}

async function getFirstWindow(electronApp) {
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await dismissChangelog(window);
  return window;
}

async function createProject(window, projectName) {
  await window.click('text="Novo Projeto"');
  await window.fill('input[placeholder="Ex: Sistemas de Recomendação na Educação"]', projectName);
  await window.click('button[type="submit"]');
  await window.waitForURL(/.*\/projects\/\d+/);
}

module.exports = {
  launchApp,
  getFirstWindow,
  createProject,
};
