const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, navigateTo } = require('./helpers');

const background = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);

// Arca 134: light mode is white or warm white, dark mode neutral or warm graphite. The tokens only exist in the real
// stylesheet, so jsdom cannot tell whether a tone paints the app; this reads the computed colours.
test('a tone chosen in the settings paints the app and survives a reload', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await navigateTo(window, 'Configurações');
    const body = window.locator('body');
    expect(await background(body)).toBe('rgb(248, 250, 252)');

    await window.getByRole('button', { name: 'Grafite quente' }).click();
    // Picked in light mode, the dark tone only waits for dark mode; its swatch already shows it.
    expect(await background(body)).toBe('rgb(248, 250, 252)');
    const swatch = window.getByRole('button', { name: 'Grafite quente' }).locator('.appearance-tone-swatch');
    expect(await background(swatch)).toBe('rgb(22, 20, 19)');

    await window.getByRole('button', { name: /Modo Escuro/ }).click();
    expect(await background(body)).toBe('rgb(22, 20, 19)');

    await window.reload();
    await expect(window.getByRole('button', { name: 'Grafite quente' })).toHaveAttribute('aria-pressed', 'true');
    expect(await background(body)).toBe('rgb(22, 20, 19)');

    await window.getByRole('button', { name: /Modo Claro/ }).click();
    await window.getByRole('button', { name: 'Branco quente' }).click();
    expect(await background(body)).toBe('rgb(247, 245, 241)');
  } finally {
    await electronApp.close();
  }
});
