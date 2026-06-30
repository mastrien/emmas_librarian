const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

async function tryCreateDuplicate(window, name) {
  await window.click('text="Projetos"');
  await window.click('text="Novo Projeto"');
  await window.fill('input[placeholder="Ex: Sistemas de Recomendação na Educação"]', name);
  await window.click('button:has-text("Criar Projeto")');
}

test('F-10 Error flow: prevent duplicate project names', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    const duplicateName = 'E2E Duplicate Project ' + Date.now();
    await createProject(window, duplicateName);
    await tryCreateDuplicate(window, duplicateName);

    // Verify error message
    const errorBox = window.locator('text=Já existe um projeto com este nome.');
    await expect(errorBox).toBeVisible();

    // Verify user remains on the new-project page
    expect(window.url()).toContain('/new-project');
  } finally {
    await electronApp.close();
  }
});
