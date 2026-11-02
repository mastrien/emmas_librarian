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

// The origin pickers carry long source names; they must shrink with the panel (the #50 mock-up's spilled out).
async function expectPickersInside(panel) {
  const spill = await panel.evaluate((node) => {
    const right = node.getBoundingClientRect().right;
    return [...node.querySelectorAll('select')].map((s) => s.getBoundingClientRect().right - right);
  });
  expect(spill.length).toBeGreaterThan(0);
  expect(spill.every((px) => px <= 1)).toBe(true);
}

async function tagOrigins(window, panel) {
  await panel.getByRole('button', { name: '+ Nova fonte' }).click();
  await panel.getByRole('textbox', { name: 'Nome' }).fill('Google Scholar com um nome bem comprido de propósito');
  await panel.getByRole('combobox', { name: 'Método' }).selectOption('websites');
  await panel.getByRole('button', { name: 'Salvar fonte' }).click();
  for (const title of ['Artigo alfa', 'Artigo beta']) {
    await panel.getByRole('checkbox', { name: `Selecionar ${title}` }).check();
  }
  await panel.getByRole('combobox', { name: /Marcar os selecionados \(2\) como/ }).selectOption({ index: 1 });
  await panel.getByRole('button', { name: 'Aplicar' }).click();
  await expect(window.getByRole('button', { name: /Sites e buscadores \(n = 2\)/ })).toBeVisible();
}

// Where the panel sits against the diagram: 'below' it or 'beside' it.
async function panelPlacement(window, panel) {
  const canvas = await window.locator('.prisma-canvas').boundingBox();
  const side = await panel.boundingBox();
  if (side.y >= canvas.y + canvas.height - 1) return 'below';
  return side.x >= canvas.x + canvas.width - 1 ? 'beside' : 'overlapping';
}

// Validation of epic #44: on a narrow window the panel squeezed the diagram's text; it goes below it instead.
async function expectPanelBelowOnlyWhenNarrow(electronApp, window, panel) {
  const resize = (w) =>
    electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 900), w);
  await resize(1000);
  await expect.poll(() => panelPlacement(window, panel), { message: '1000px' }).toBe('below');
  await resize(1700);
  await expect.poll(() => panelPlacement(window, panel), { message: '1700px' }).toBe('beside');
}

// The export note is a plain line of small text on the right, with no box behind it (validation of epic #44).
async function expectPlainExportNote(note) {
  const look = await note.evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, border: style.borderTopStyle, align: style.textAlign };
  });
  expect(look).toEqual({ background: 'rgba(0, 0, 0, 0)', border: 'none', align: 'right' });
}

// #50: articles added by hand go to the "other methods" column, their origin is told (never a number typed), each
// box says where its number comes from, and the export writes the image with both tables beside it.
test('draws the PRISMA diagram from the screening and exports it with its tables', async () => {
  test.setTimeout(180000);
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

    await window.getByRole('link', { name: 'Diagrama PRISMA' }).click();
    await expect(window.getByRole('img', { name: 'Diagrama PRISMA 2020 da revisão' })).toBeVisible();
    await window.getByRole('button', { name: /^Registros identificados \(n = 2\)/ }).click();
    const panel = window.getByRole('complementary', { name: 'De onde vem o número' });
    await expect(panel.getByRole('note')).toContainText('2 artigo(s) ainda sem origem informada');
    await tagOrigins(window, panel);
    await expectPickersInside(panel);

    await window.getByRole('button', { name: /^Publicações avaliadas para elegibilidade \(n = 2\)/ }).click();
    await expect(panel.getByRole('note')).toContainText('Triagem em andamento: 1 artigo(s)');
    await expect(panel).toContainText('Artigo beta');

    await window.getByRole('button', { name: 'Exportar ▾' }).click();
    await window.getByRole('menuitem', { name: /SVG \+ tabelas/ }).click();
    const note = window.getByText(`Diagrama salvo em ${target}, com as duas tabelas ao lado.`);
    await expect(note).toBeVisible();
    await expectPlainExportNote(note);
    await expectPanelBelowOnlyWhenNarrow(electronApp, window, panel);
    const svg = fs.readFileSync(target, 'utf8');
    expect(svg).toContain('Identificação de estudos por outros métodos');
    // In two columns the included box is narrower: its number goes to the line under the title, never cut.
    expect(svg).toMatch(/Estudos incluídos na revisão<\/tspan><tspan[^>]*>\(n = 0\)</);
    expect(fs.readFileSync(path.join(dir, 'prisma_dados.csv'), 'utf8')).toContain(
      '"Outros métodos","Publicações excluídas","","1"',
    );
    expect(fs.readFileSync(path.join(dir, 'prisma_excluidas.csv'), 'utf8')).toMatch(/Artigo alfa.*Título e resumo/);

    await window.getByRole('button', { name: /Ajuda/ }).click();
    await expect(window.getByText('Guia da Revisão Sistemática')).toBeVisible();
    // The guide fits the window and its end can be scrolled to (it overflowed, validation of epic #44).
    const help = window.getByRole('dialog', { name: 'Guia da Revisão Sistemática' });
    const box = await help.boundingBox();
    // Electron has no fixed viewport (viewportSize() is null): the page says how tall the window is.
    const windowHeight = await window.evaluate(() => globalThis.innerHeight);
    expect(box.y + box.height).toBeLessThanOrEqual(windowHeight);
    await window.getByRole('link', { name: 'A declaração PRISMA 2020 (tradução oficial)' }).scrollIntoViewIfNeeded();
    await expect(window.getByRole('link', { name: 'A declaração PRISMA 2020 (tradução oficial)' })).toBeInViewport();
    await expect(window.getByRole('button', { name: 'Entendi' })).toBeInViewport();
  } finally {
    await electronApp.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
