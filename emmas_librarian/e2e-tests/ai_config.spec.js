const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, navigateTo } = require('./helpers');

async function fillOpenaiKey(window, key) {
  await navigateTo(window, 'Configurações');
  await window.waitForTimeout(1000);
  const locator = window.locator('input[placeholder="sk-..."]');
  await window.fill('input[placeholder="sk-..."]', key);
  await expect(locator).toHaveValue(key);
  await window.click('button:has-text("Salvar Chaves")');
  await window.waitForSelector('button:has-text("Salvo!")');
}

async function verifyKeyPersisted(window, expectedKey) {
  await navigateTo(window, 'Projetos');
  await navigateTo(window, 'Configurações');
  const locator = window.locator('input[placeholder="sk-..."]');
  await expect(locator).toHaveValue(expectedKey);
}

test('F-08 Configure AI provider settings', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    const testKey = 'sk-e2e-test-key-' + Date.now();
    await fillOpenaiKey(window, testKey);
    await verifyKeyPersisted(window, testKey);
  } finally {
    await electronApp.close();
  }
});
