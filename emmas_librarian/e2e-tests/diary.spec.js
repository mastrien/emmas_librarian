const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, dismissChangelog } = require('./helpers');

const editor = (window) => window.locator('[contenteditable="true"]').first();

async function openTodayPage(window) {
  await window.getByTestId('tab-diary').click();
  // Board 155: "+" beside "Páginas" opens (or creates) today's page.
  await window.getByRole('button', { name: 'Página de hoje', exact: true }).click();
  await expect(editor(window)).toBeVisible({ timeout: 10000 });
}

/** Replaces the whole page content, typing like a user (the editor is Lexical/contentEditable). */
async function writePage(window, text) {
  await editor(window).click();
  await window.keyboard.press('Control+A');
  await window.keyboard.type(text);
}

// The diary saves by itself 2s after the last keystroke (no save button since the redesign).
async function saveNow(window) {
  await expect(window.locator('.diary-save--done')).toContainText('Salvo às', { timeout: 10000 });
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
      await window
        .getByRole('navigation', { name: 'Páginas do diário' })
        .getByRole('button', { name: /^Hoje/ })
        .click();
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
      const dialog = window.getByRole('dialog', { name: 'Histórico de Versões' });
      await expect(dialog).toBeVisible();
      // Board 180: the newest earlier version is chosen, and the diff against the current text is marked.
      await expect(dialog.locator('.diary-history__text del')).toHaveText('um');
      await expect(dialog.locator('.diary-history__text ins')).toHaveText('dois');
      await dialog.getByRole('button', { name: 'Restaurar esta versão' }).click();

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

      await expect(window.getByText('Nenhuma página ainda.')).toBeVisible();
      await expect(editor(window)).toBeHidden();
    });
  });

  // Smoke test of the page that overwrote another. The local IPC answers too fast to reproduce the race here, so what
  // proves it is DiarySection.test ("never mixes the text of two pages"), where one page answers late.
  test('opening pages in quick succession never moves text from one page to another', async () => {
    await withProject(async (window) => {
      const projectId = Number((await window.evaluate(() => location.hash)).match(/projects\/(\d+)/)[1]);
      const call = (channel, ...args) =>
        window.evaluate(([c, a]) => window.electronAPI.invoke(c, ...a), [channel, args]);
      await call('diary:save', projectId, '2026-03-04', 'Página A original');
      await call('diary:save', projectId, '2026-03-05', 'Página B original');
      await window.getByTestId('tab-diary').click();
      const pages = window.getByRole('navigation', { name: 'Páginas do diário' });
      const pageA = pages.getByRole('button', { name: /^04\/03/ });
      const pageB = pages.getByRole('button', { name: /^05\/03/ });

      for (let i = 0; i < 8; i += 1) {
        await pageA.click();
        await pageB.click();
      }
      await expect(editor(window)).toContainText('Página B original');
      await writePage(window, 'Página B editada');
      await saveNow(window);

      expect((await call('diary:getOne', projectId, '2026-03-04')).content).toBe('Página A original');
      expect((await call('diary:getOne', projectId, '2026-03-05')).content).toContain('Página B editada');
    });
  });
});
