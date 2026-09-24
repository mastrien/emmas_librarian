const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, getFirstWindow, createProject, dismissChangelog } = require('./helpers');
const { IMPORTED_TITLE, copyFixturePdf, importFixturePdf, openReader } = require('./articleFixture');

/** Creates a category in the "Categorias do Projeto" modal. `options` only for list types. */
async function addCategory(window, name, typeLabel, options) {
  await window.getByPlaceholder('Nome (ex: Metodologia)').fill(name);
  await window
    .locator('select', { has: window.locator('option', { hasText: 'Lista de Opções' }) })
    .first()
    .selectOption({ label: typeLabel });
  if (options) await window.getByPlaceholder(/Opções separadas por vírgula/).fill(options);
  await window.getByPlaceholder('Nome (ex: Metodologia)').press('Enter');
  await expect(window.getByText(name, { exact: true }).first()).toBeVisible();
}

/** In the reader's "Categorizar" panel: the editor for one category, found by its label. */
const categoryEditor = (window, category) => window.locator('label', { hasText: category }).locator('..');

/** The read-only cell of `articleTitle` under the column `category` in the project's Categories tab. */
async function categoryCell(window, articleTitle, category) {
  const headers = await window.locator('table thead th').allInnerTexts();
  const column = headers.findIndex((h) => h.trim() === category);
  expect(column, `column "${category}" in ${JSON.stringify(headers)}`).toBeGreaterThan(-1);
  return window.locator('table tbody tr', { hasText: articleTitle }).locator('td').nth(column);
}

test('F-11 Create categories, classify an article in the reader and export the values', async () => {
  const fixture = copyFixturePdf();
  const csvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-categories-'));
  const csvPath = path.join(csvDir, 'export.csv');
  const electronApp = await launchApp({
    E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath,
    E2E_MOCK_SAVE_FILE_PATH: csvPath,
  });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Categorias ' + Date.now());
    await importFixturePdf(window);

    await window.getByRole('button', { name: 'Criar categorias' }).click();
    await addCategory(window, 'Metodologia', 'Texto');
    await addCategory(window, 'Tipo de estudo', 'Lista de Opções', 'Qualitativa, Quantitativa');
    await addCategory(window, 'Revisado', 'Sim/Não');
    await window.getByRole('button', { name: 'Fechar' }).click();

    // Classify the article where users do it: the reader's floating "Categorizar" panel.
    await openReader(window);
    await window.getByTitle('Categorias do Artigo').click();
    await categoryEditor(window, 'Metodologia').getByText('Adicionar').click();
    await window.keyboard.type('Survey online');
    await window.keyboard.press('Enter');
    await categoryEditor(window, 'Tipo de estudo').locator('select').selectOption('Quantitativa');
    await categoryEditor(window, 'Revisado').locator('select').selectOption('true');
    await expect(categoryEditor(window, 'Metodologia')).toContainText('Survey online');

    // The project's Categories tab lists the saved values, also after reloading the app.
    await window.goBack();
    await window.waitForURL(/\/projects\/\d+/);
    for (const reload of [false, true]) {
      if (reload) {
        await window.reload();
        await dismissChangelog(window);
      }
      await window.getByTestId('tab-categories').click();
      await expect(await categoryCell(window, IMPORTED_TITLE, 'Metodologia')).toHaveText('Survey online');
      await expect(await categoryCell(window, IMPORTED_TITLE, 'Tipo de estudo')).toHaveText('Quantitativa');
      await expect(await categoryCell(window, IMPORTED_TITLE, 'Revisado')).toHaveText('Sim');
    }

    // The CSV export carries one column per category.
    await window.getByRole('button', { name: 'Exportar CSV' }).click();
    await expect
      .poll(() => (fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : ''), { timeout: 10000 })
      .toContain('Survey online');
    const [header, row] = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
    expect(header).toBe('id,doi,title,authors,year,source,status,Metodologia,Tipo de estudo,Revisado');
    expect(row).toContain('"Survey online","Quantitativa","true"');
  } finally {
    await electronApp.close();
    fixture.cleanup();
    fs.rmSync(csvDir, { recursive: true, force: true });
  }
});
