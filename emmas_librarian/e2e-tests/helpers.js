const { _electron: electron } = require('playwright');
const path = require('path');

function checkHeadless() {
  const isHeadless = process.env.HEADLESS_E2E === 'true' || (process.env.CI === 'true' && process.platform !== 'win32');
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
    await window.evaluate(() => {
      localStorage.setItem('last_seen_version', '1.1.16');
    }).catch(() => {});
    const changelogBtn = window.locator('button:has-text("Entendido, vamos lá!")');
    if (await changelogBtn.isVisible().catch(() => false)) {
      await changelogBtn.click().catch(() => {});
    }
  } catch (e) {
    // Changelog modal not shown
  }
}

async function getFirstWindow(electronApp) {
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  window.on('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  await dismissChangelog(window);
  return window;
}

async function createProject(window, projectName) {
  const isNewProjBtnVisible = await window.locator('text="Novo Projeto"').first().isVisible().catch(() => false);
  if (!isNewProjBtnVisible) {
    await navigateTo(window, 'Projetos');
  }
  await window.click('text="Novo Projeto"');
  await window.fill('input[placeholder="Ex: Sistemas de Recomendação na Educação"]', projectName);
  await window.click('button[type="submit"]');
  await window.waitForURL(/.*\/projects\/\d+/);
}

async function navigateTo(window, target) {
  const directLink = window.locator('a, button').filter({ hasText: target }).first();
  if (await directLink.isVisible().catch(() => false)) {
    await directLink.click();
    return;
  }
  const moreBtn = window.locator('button[title="Mais opções"]').first();
  await moreBtn.hover();
  await window.waitForTimeout(100);
  const menuLink = window.locator('.menu-dropdown-item, a, button').filter({ hasText: target }).first();
  await menuLink.click();
}

async function clickAddArticlesOption(window, optionText) {
  const directBtn = window.locator('button').filter({ hasText: optionText }).first();
  if (await directBtn.isVisible().catch(() => false)) {
    await directBtn.click();
    return;
  }
  const addBtn = window.locator('button:has-text("Adicionar Artigos")').first();
  await addBtn.hover();
  await window.waitForTimeout(100);
  const menuItem = window.locator('.menu-dropdown-item, button').filter({ hasText: optionText }).first();
  await menuItem.click();
}

async function clickExportOption(window, optionText) {
  const directBtn = window.locator('button').filter({ hasText: optionText }).first();
  if (await directBtn.isVisible().catch(() => false)) {
    await directBtn.click();
    return;
  }
  const exportBtn = window.locator('button:has-text("Exportar")').first();
  await exportBtn.hover();
  await window.waitForTimeout(100);
  const menuItem = window.locator('.menu-dropdown-item, button').filter({ hasText: optionText }).first();
  await menuItem.click();
}

module.exports = {
  launchApp,
  getFirstWindow,
  createProject,
  navigateTo,
  clickAddArticlesOption,
  clickExportOption,
};
