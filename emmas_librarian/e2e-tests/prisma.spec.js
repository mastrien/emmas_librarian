const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

async function addManualArticle(window, title) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
  await window.click('button[type="submit"]');
}

async function pickLabel(window, title, label) {
  const row = window.getByTestId('review-row').filter({ hasText: title });
  await row.getByRole('button', { name: /Rótulo/ }).click();
  await row.getByRole('menuitem', { name: new RegExp(label) }).click();
}

// #50: the diagram is drawn from the project's data, each box says where its number comes from, and the export
// writes the image with its data table beside it.
test('draws the PRISMA diagram from the screening and exports it with its data table', async () => {
  test.setTimeout(150000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-prisma-e2e-'));
  const target = path.join(dir, 'prisma.svg');
  const electronApp = await launchApp({ E2E_MOCK_SAVE_FILE_PATH: target });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'PRISMA ' + Date.now());
    for (const title of ['Artigo alfa', 'Artigo beta']) await addManualArticle(window, title);
    await expect(window.getByTestId('main-articles-table').getByText('Artigo beta')).toBeVisible();
    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await pickLabel(window, 'Artigo alfa', 'Excluído');
    await pickLabel(window, 'Artigo beta', 'Incluso');

    // Articles added by hand count as other sources; one screening step still waits for the full text.
    await window.getByRole('link', { name: 'Diagrama PRISMA' }).click();
    const diagram = window.getByRole('img', { name: 'Diagrama PRISMA 2020 da revisão' });
    await expect(diagram).toBeVisible();
    await expect(window.getByRole('button', { name: /^Registros identificados \(n = 2\)/ })).toBeVisible();
    await window.getByRole('button', { name: /^Relatórios avaliados para elegibilidade \(n = 1\)/ }).click();
    const panel = window.getByRole('complementary', { name: 'De onde vem o número' });
    await expect(panel.getByRole('note')).toContainText('1 sem decisão ou em dúvida no texto completo');
    await expect(panel).toContainText('Artigo beta');

    await window.getByRole('button', { name: 'Exportar ▾' }).click();
    await window.getByRole('menuitem', { name: /SVG \+ tabela de dados/ }).click();
    await expect(window.getByText(`Diagrama salvo em ${target}, com a tabela de dados ao lado.`)).toBeVisible();
    expect(fs.readFileSync(target, 'utf8')).toContain('Estudos incluídos na revisão (n = 0)');
    expect(fs.readFileSync(path.join(dir, 'prisma_dados.csv'), 'utf8')).toContain('"Registros excluídos","","1"');
  } finally {
    await electronApp.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
