const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, dismissChangelog } = require('./helpers');

const editor = (window) => window.locator('[contenteditable="true"]').first();

async function openTodayPage(window) {
  await window.getByTestId('tab-diary').click();
  await window.getByRole('button', { name: 'Página de Hoje' }).click();
  await expect(editor(window)).toBeVisible({ timeout: 10000 });
}

/** Replaces the whole page content, typing like a user (the editor is Lexical/contentEditable). */
async function writePage(window, text) {
  await editor(window).click();
  await window.keyboard.press('Control+A');
  await window.keyboard.type(text);
}

async function saveNow(window) {
  await window.getByRole('button', { name: 'Salvar' }).click();
  await expect(window.getByText('Não salvo')).toBeHidden();
}

async function withProject(run) {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);
  try {
    await createProject(window, 'Diário ' + Date.now());
    await run(window);
  } finally {
    await electronApp.close();
  }
}

test.describe('Project diary', () => {
  test("autosaves today's page and shows it again after reloading the app", async () => {
    await withProject(async (window) => {
      await openTodayPage(window);
      await writePage(window, 'Primeira leitura do artigo de teste.');

      await expect(window.getByText('Não salvo')).toBeVisible();
      // Autosave fires 2s after the last keystroke.
      await expect(window.getByText('Não salvo')).toBeHidden({ timeout: 10000 });

      await window.reload();
      await dismissChangelog(window);
      await window.getByTestId('tab-diary').click();
      await window.getByRole('button', { name: /Hoje/ }).filter({ hasNotText: 'Página de Hoje' }).click();
      await expect(editor(window)).toContainText('Primeira leitura do artigo de teste.');
    });
  });

  test('restores a previous version from the history', async () => {
    await withProject(async (window) => {
      await openTodayPage(window);
      await writePage(window, 'Versão um do diário.');
      await saveNow(window);
      await writePage(window, 'Versão dois do diário.');
      await saveNow(window);

      await window.getByTitle('Histórico de Versões').click();
      const dialog = window.locator('.card', { hasText: 'Histórico de Versões' });
      await expect(dialog).toBeVisible();
      // The innermost element holding both the preview and a button is that version's card.
      const versionOne = dialog
        .locator('div')
        .filter({ hasText: 'Versão um do diário.' })
        .filter({ has: window.getByRole('button', { name: 'Restaurar' }) })
        .last();
      await versionOne.getByRole('button', { name: 'Restaurar' }).click();

      await expect(editor(window)).toContainText('Versão um do diário.');
      await expect(editor(window)).not.toContainText('Versão dois do diário.');
    });
  });

  test('deletes a page after confirmation', async () => {
    await withProject(async (window) => {
      await openTodayPage(window);
      await writePage(window, 'Página que será excluída.');
      await saveNow(window);

      await window.getByTitle('Excluir página').click();
      await expect(window.getByText('Excluir página?')).toBeVisible();
      await window.getByRole('button', { name: 'Excluir', exact: true }).click();

      await expect(window.getByText(/Nenhuma entrada ainda/)).toBeVisible();
      await expect(editor(window)).toBeHidden();
    });
  });
});
