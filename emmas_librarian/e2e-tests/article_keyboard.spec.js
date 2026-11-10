const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

// Board 153: the article list is keyboard-first ("J K linha · Enter abrir · X selecionar").
async function addManualArticle(window, title) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
  await window.click('button[type="submit"]');
}

test('J moves through the rows, X selects one and Enter opens the details', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Teclado ' + Date.now());
    await addManualArticle(window, 'Artigo um');
    await addManualArticle(window, 'Artigo dois');
    const table = window.getByTestId('main-articles-table');
    await expect(table.getByText('Artigo um')).toBeVisible();
    await window.locator('body').click({ position: { x: 5, y: 300 } });

    await window.keyboard.press('j');
    await window.keyboard.press('j');
    await expect(table.locator('tr.is-current')).toContainText('Artigo um');

    await window.keyboard.press('x');
    await expect(window.getByRole('checkbox', { name: 'Selecionar "Artigo um"' })).toBeChecked();
    await window.getByRole('button', { name: /Sair da seleção/, pressed: true }).click();

    // Enter on a focused button stays that button's; away from controls it opens the current row.
    await window.locator('body').click({ position: { x: 5, y: 300 } });
    await window.keyboard.press('Enter');
    await expect(window.getByRole('complementary', { name: 'Detalhes do artigo' })).toContainText('Artigo um');

    // Escape closes the details; Space opens them again for the current row.
    await window.keyboard.press('Escape');
    await expect(window.getByRole('complementary', { name: 'Detalhes do artigo' })).toBeHidden();
    await window.keyboard.press(' ');
    await expect(window.getByRole('complementary', { name: 'Detalhes do artigo' })).toContainText('Artigo um');
  } finally {
    await electronApp.close();
  }
});
