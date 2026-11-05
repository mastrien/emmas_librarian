const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

// Validation of epic #44: the labels window opened in a corner, its backdrop a small margin around it, because a page
// class took its name. Every modal now comes from one component; this checks the real layout, which jsdom cannot.
test('a modal darkens the whole screen and its window is padded', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Modal ' + Date.now());
    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await window.getByRole('button', { name: /Gerenciar rótulos/ }).click();

    const dialog = window.getByRole('dialog', { name: 'Rótulos de triagem' });
    await expect(dialog).toBeVisible();
    const overlay = window.getByTestId('app-modal-overlay');
    const viewport = await window.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const covered = await overlay.boundingBox();
    expect(covered.x).toBe(0);
    expect(covered.y).toBe(0);
    expect(Math.round(covered.width)).toBe(viewport.width);
    expect(Math.round(covered.height)).toBe(viewport.height);

    const box = await dialog.boundingBox();
    const centre = box.x + box.width / 2;
    expect(Math.abs(centre - viewport.width / 2)).toBeLessThan(2);
    const padding = await dialog.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(padding).toBeGreaterThanOrEqual(16);

    await window.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  } finally {
    await electronApp.close();
  }
});
