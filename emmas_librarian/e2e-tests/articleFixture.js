// Shared steps for specs that need a real PDF: the synthetic article in fixtures/artigo-teste-emma.pdf
// (regenerate with `node e2e-tests/fixtures/generate-article-pdf.cjs`; content in fixtures/articleContent.cjs).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('@playwright/test');
const { clickAddArticlesOption } = require('./helpers');
const { METADATA, SENTINELS } = require('./fixtures/articleContent.cjs');

const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'artigo-teste-emma.pdf');
/** Batch import names the article after the file. */
const IMPORTED_TITLE = 'artigo-teste-emma';

/**
 * Copies the fixture PDF into a fresh temp folder (the app must never touch the committed file).
 * Pass `pdfPath` as E2E_MOCK_OPEN_MULTIPLE_FILES / E2E_MOCK_OPEN_FILE and call `cleanup()` in `finally`.
 */
function copyFixturePdf() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emmas-fixture-'));
  const pdfPath = path.join(dir, path.basename(FIXTURE_PDF));
  fs.copyFileSync(FIXTURE_PDF, pdfPath);
  return { dir, pdfPath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** Imports the fixture through "Importar PDFs em Lote" and waits for the confirmation and the table row. */
async function importFixturePdf(window) {
  const confirmation = window.waitForEvent('dialog');
  await clickAddArticlesOption(window, 'Importar PDFs em Lote');
  expect((await confirmation).message()).toBe('1 artigo(s) importado(s) com sucesso.');
  await expect(window.locator('table').getByText(IMPORTED_TITLE)).toBeVisible({ timeout: 15000 });
}

/** From the project page: article details → "Visualizar PDF", then waits for pdf.js to render text. */
async function openReader(window, title = IMPORTED_TITLE) {
  await window.locator('table').getByText(title).first().click();
  await window.getByRole('link', { name: /Visualizar PDF/ }).click();
  await window.waitForURL(/\/articles\/\d+/);
  await expect(window.locator('.textLayer').getByText(METADATA.journal).first()).toBeVisible({ timeout: 20000 });
}

module.exports = { FIXTURE_PDF, IMPORTED_TITLE, METADATA, SENTINELS, copyFixturePdf, importFixturePdf, openReader };
