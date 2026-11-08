const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

// Arca 138: in a column container (the "Avaliar sugestões" tab, the suggestion block of the guided screening) the
// Experimental tag stretched to the full width, a bar instead of a label. jsdom has no layout, so this checks it here.
test('the Experimental tag keeps the width of its word in a column container', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Etiqueta ' + Date.now());
    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await window.getByRole('link', { name: 'Avaliar sugestões' }).click();

    const section = window.getByRole('region', { name: 'Avaliar sugestões' });
    const tag = section.getByTestId('experimental-tag').first();
    await expect(tag).toBeVisible();
    const tagBox = await tag.boundingBox();
    const sectionBox = await section.boundingBox();
    expect(tagBox.width).toBeLessThan(160);
    expect(tagBox.width).toBeLessThan(sectionBox.width / 4);
  } finally {
    await electronApp.close();
  }
});
