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
      localStorage.setItem('last_seen_version', '1.1.19');
    }).catch(() => {});

    const changelogBtn = window.locator('button').filter({ hasText: /^Entendido/ }).first();
    if (await changelogBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await changelogBtn.click().catch(() => {});
      await window.waitForTimeout(300);
    }
  } catch (e) {
    // Changelog modal not shown
  }
}

async function getFirstWindow(electronApp) {
  const window = await electronApp.firstWindow();
  window.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.type()} - ${msg.text()}`));
  window.on('pageerror', exception => console.log(`BROWSER ERROR: ${exception}`));
  await window.waitForLoadState('domcontentloaded');
  window.on('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });
  await dismissChangelog(window);
  return window;
}

async function createProject(window, projectName) {
  await dismissChangelog(window);
  const newProjBtn = window.locator('a, button').filter({ hasText: 'Novo Projeto' }).first();
  await newProjBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
  const isNewProjBtnVisible = await newProjBtn.isVisible().catch(() => false);
  if (!isNewProjBtnVisible) {
    await navigateTo(window, 'Projetos');
  }
  await newProjBtn.click();
  await window.fill('input[placeholder^="Ex: Sistemas"]', projectName);
  await window.click('button[type="submit"]');
  await window.waitForURL(/.*\/projects\/\d+/);
}

async function navigateTo(window, target) {
  await dismissChangelog(window);

  // Retry loop to handle DOM detachment from React re-renders during
  // async data loading (e.g. Dashboard's DeadlineBanner "Ver Agenda"
  // button gets detached when venue data finishes loading).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const directLink = window.locator('a, button').filter({ hasText: target }).first();
      await directLink.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null);
      if (await directLink.isVisible().catch(() => false)) {
        await directLink.click({ timeout: 5000 });
        return;
      }
    } catch (err) {
      // Element was likely detached during a re-render; retry
      if (attempt < 2) {
        await window.waitForTimeout(500);
        continue;
      }
    }
  }

  // Fallback: open "Mais opções" dropdown and click the menu item
  const moreBtn = window.locator('button[title^="Mais op"]').first();
  await moreBtn.hover();
  await window.waitForTimeout(300);
  const menuLink = window.locator('.menu-dropdown-item, a, button').filter({ hasText: target }).first();
  await menuLink.click();
}

async function clickAddArticlesOption(window, optionText) {
  await dismissChangelog(window);
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

module.exports = {
  launchApp,
  getFirstWindow,
  createProject,
  navigateTo,
  clickAddArticlesOption,
  dismissChangelog,
};
