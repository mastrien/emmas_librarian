const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

// Redesign, board 150: the header with "Mais opções" became a title bar with the path to the screen and a rail of
// module icons on the left.

const noHorizontalScroll = (window) =>
  window.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('the rail reaches every module and lights the one in use', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    const rail = window.getByRole('navigation', { name: 'Módulos' });

    await rail.getByRole('link', { name: 'Agenda', exact: true }).click();
    await expect(window).toHaveURL(/#\/agenda$/);
    await expect(rail.getByRole('link', { name: 'Agenda', exact: true })).toHaveAttribute('aria-current', 'page');

    await rail.getByRole('link', { name: 'Configurações', exact: true }).click();
    await expect(window).toHaveURL(/#\/settings$/);
    await expect(window.getByRole('navigation', { name: 'Caminho' })).toContainText('Configurações');

    await rail.getByRole('link', { name: 'Início', exact: true }).click();
    await expect(window).toHaveURL(/#\/$/);
  } finally {
    await electronApp.close();
  }
});

test('the title bar path names the project and leads back home', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);
  const name = 'Caminho ' + Date.now();

  try {
    await createProject(window, name);
    const path = window.getByRole('navigation', { name: 'Caminho' });
    await expect(path.getByText(name)).toHaveAttribute('aria-current', 'page');

    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await expect(path.getByRole('link', { name })).toBeVisible();
    await expect(path.getByText('Triagem')).toHaveAttribute('aria-current', 'page');

    await path.getByRole('link', { name: 'Início' }).click();
    await expect(window).toHaveURL(/#\/$/);
  } finally {
    await electronApp.close();
  }
});

// A long project name must shrink with an ellipsis instead of pushing the page sideways, also on a narrow window.
test('a long project name never makes the window scroll sideways', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(
      window,
      'Previsão climática de precipitação com aprendizado profundo em regiões tropicais ' + Date.now(),
    );
    await window.setViewportSize({ width: 900, height: 700 });

    expect(await noHorizontalScroll(window)).toBe(true);
    const bar = await window.locator('.app-titlebar').boundingBox();
    expect(bar.height).toBe(32);
  } finally {
    await electronApp.close();
  }
});
