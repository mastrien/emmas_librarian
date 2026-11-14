const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const xlsx = require('xlsx');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption, answerAppDialog } = require('./helpers');

const TITLE = 'Revisão sobre métodos de avaliação';
const BOM = '﻿';

async function addManualArticle(window, title) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Emma Watson');
  await window.click('button[type="submit"]');
}

/** Clicks the export control and answers the app's confirmation, which only shows once the file is written. */
async function exportAndConfirm(window, click, expectedMessage) {
  await click();
  expect(await answerAppDialog(window, 'Exportação concluída', 'Entendi')).toBe(expectedMessage);
}

test('F-06 exports the project articles to CSV, XLSX and Biblioshiny', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-export-'));
  const target = path.join(tempDir, 'export.file');
  const electronApp = await launchApp({ E2E_MOCK_SAVE_FILE_PATH: target });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Export Project ' + Date.now());
    await addManualArticle(window, TITLE);
    await window.getByTestId('tab-categories').click();

    await exportAndConfirm(
      window,
      () => window.getByRole('button', { name: 'Exportar CSV' }).click(),
      `CSV exportado com sucesso para: ${target}`,
    );
    // The BOM makes Excel read the accents; the header is the documented column order.
    const csv = fs.readFileSync(target, 'utf8');
    expect(csv.startsWith(BOM)).toBe(true);
    const [header, ...rows] = csv.slice(1).trim().split('\n');
    expect(header).toBe('id,doi,title,authors,year,source,status,archive_note');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(`"${TITLE}","Emma Watson"`);

    await exportAndConfirm(
      window,
      () => window.getByRole('button', { name: 'Exportar XLSX' }).click(),
      `XLSX exportado com sucesso para: ${target}`,
    );
    const sheet = xlsx.readFile(target).Sheets.Artigos;
    expect(xlsx.utils.sheet_to_json(sheet)[0]).toMatchObject({ title: TITLE, authors: 'Emma Watson' });

    // The project "Exportar" menu sits in the Artigos header since the redesign (board 153).
    await window.getByTestId('tab-articles').click();
    await exportAndConfirm(
      window,
      async () => {
        // The menu opens on hover; a click after the hover would toggle it closed again.
        await window.getByRole('button', { name: 'Exportar', exact: true }).hover();
        await window.getByRole('button', { name: 'Biblioshiny' }).click();
      },
      `CSV do Biblioshiny exportado com sucesso para: ${target}`,
    );
    const [biblioHeader, biblioRow] = fs.readFileSync(target, 'utf8').slice(1).split('\r\n');
    expect(biblioHeader.split('","')).toHaveLength(45);
    expect(biblioRow).toContain(`"${TITLE}"`);
  } finally {
    await electronApp.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
