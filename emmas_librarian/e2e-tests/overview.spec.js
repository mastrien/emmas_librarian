const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

// Redesign board 154: the project opens on its overview, "Sobre o projeto" in markdown beside compact numbers.

const noHorizontalScroll = (window) =>
  window.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('"Sobre o projeto" is saved as it is typed and is there after a reload', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Visão geral ' + Date.now());
    await window.getByTestId('tab-overview').click();
    // MDXEditor's editable area; its placeholder shares the content class, so find it by role.
    const page = () =>
      window.getByRole('region', { name: 'Sobre o projeto' }).getByRole('textbox', { name: 'editable markdown' });
    await page().click();
    await window.keyboard.type('Prever a chuva com aprendizado profundo.');

    await expect(window.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible({ timeout: 10000 });
    await window.reload();
    await expect(page()).toContainText('Prever a chuva com aprendizado profundo.');
  } finally {
    await electronApp.close();
  }
});

test('the overview keeps two columns on a wide window and one on a narrow one, never scrolling sideways', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);
  const setWidth = (w) =>
    electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 850), w);

  try {
    await createProject(window, 'Colunas ' + Date.now());
    await window.getByTestId('tab-overview').click();
    const about = window.getByRole('region', { name: 'Sobre o projeto' });
    const numbers = window.getByRole('complementary', { name: 'Números do projeto' });

    await setWidth(1366);
    await expect.poll(async () => (await numbers.boundingBox()).x > (await about.boundingBox()).x).toBe(true);
    expect(await noHorizontalScroll(window)).toBe(true);

    await setWidth(1000);
    await expect.poll(async () => (await numbers.boundingBox()).y > (await about.boundingBox()).y).toBe(true);
    expect(await noHorizontalScroll(window)).toBe(true);
  } finally {
    await electronApp.close();
  }
});
