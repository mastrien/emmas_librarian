const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');
const { METADATA, SENTINELS, copyFixturePdf, importFixturePdf, openReader } = require('./articleFixture');

/** Launches the app, imports the fixture article into a new project and opens it in the reader. */
async function openFixtureInReader() {
  const fixture = copyFixturePdf();
  const electronApp = await launchApp({ E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath });
  const window = await getFirstWindow(electronApp);
  await createProject(window, 'Leitor ' + Date.now());
  await importFixturePdf(window);
  await openReader(window);
  const close = async () => {
    await electronApp.close();
    fixture.cleanup();
  };
  return { window, close };
}

const pageInput = (window) => window.getByLabel('Página atual');
const annotationsHeading = (window) => window.getByRole('heading', { name: /^Anotações \(\d+\)$/ });

/** Selects a line of the PDF text layer with the mouse, the way a reader would before highlighting. */
async function selectPdfText(window, text) {
  const span = window.locator('.textLayer span', { hasText: text }).first();
  const box = await span.boundingBox();
  await window.mouse.move(box.x + 1, box.y + box.height / 2);
  await window.mouse.down();
  await window.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 });
  await window.mouse.up();
}

/** Leaves the reader and opens the same article again, so assertions read what was persisted. */
async function reopenReader(window) {
  await window.goBack();
  await window.waitForURL(/\/projects\/\d+/);
  await openReader(window);
}

test.describe('PDF reader', () => {
  test('renders the article text layer, pages through it and zooms', async () => {
    const { window, close } = await openFixtureInReader();
    try {
      await expect(window.locator('.textLayer').getByText(METADATA.shortTitle).first()).toBeVisible();
      await expect(window.getByText('de 4', { exact: true })).toBeVisible();
      await expect(pageInput(window)).toHaveValue('1');

      await window.getByRole('button', { name: 'Próxima página' }).click();
      await expect(pageInput(window)).toHaveValue('2');

      await pageInput(window).fill('4');
      await pageInput(window).press('Enter');
      await expect(pageInput(window)).toHaveValue('4');
      await expect(window.getByRole('button', { name: 'Próxima página' })).toBeDisabled();

      await window.getByTitle('Mais zoom').click();
      await expect(window.getByText('110%')).toBeVisible();
    } finally {
      await close();
    }
  });

  test('finds a term inside the PDF and jumps to its page', async () => {
    const { window, close } = await openFixtureInReader();
    try {
      await window.getByRole('button', { name: 'Pesquisar', exact: true }).click();
      await window.getByPlaceholder('Termo para busca...').fill(SENTINELS.search);
      await window.getByPlaceholder('Termo para busca...').press('Enter');

      await expect(window.getByText('1 ocorrência(s) encontrada(s)')).toBeVisible({ timeout: 15000 });
      const result = window.locator('.card', { hasText: 'Página 3' });
      await expect(result).toBeVisible();

      await result.click();
      await expect(pageInput(window)).toHaveValue('3');
    } finally {
      await close();
    }
  });

  test('highlights a selected passage with a note and keeps it after reopening', async () => {
    const { window, close } = await openFixtureInReader();
    try {
      await expect(annotationsHeading(window)).toHaveText('Anotações (0)');

      await selectPdfText(window, SENTINELS.highlight);
      await window.getByPlaceholder('Adicionar nota (opcional)...').fill('Pergunta central do estudo');
      await window.getByRole('button', { name: 'Destacar' }).click();

      await expect(annotationsHeading(window)).toHaveText('Anotações (1)');
      await expect(window.getByText('Pergunta central do estudo')).toBeVisible();

      await reopenReader(window);
      await expect(annotationsHeading(window)).toHaveText('Anotações (1)');
      await expect(window.getByText('Pergunta central do estudo')).toBeVisible();
    } finally {
      await close();
    }
  });

  test('adds a standalone annotation that persists', async () => {
    const { window, close } = await openFixtureInReader();
    try {
      await window.getByPlaceholder('Nova anotação avulsa...').fill('Comparar com a revisão de 2023');
      await window.getByRole('button', { name: 'Adicionar' }).click();

      await expect(annotationsHeading(window)).toHaveText('Anotações (1)');
      await reopenReader(window);
      await expect(window.getByText('Comparar com a revisão de 2023')).toBeVisible();
    } finally {
      await close();
    }
  });

  test('generates an ABNT citation from the article metadata and saves the metadata', async () => {
    const { window, close } = await openFixtureInReader();
    try {
      await window.getByTitle('Gerar Citação').click();
      await window.getByRole('button', { name: /Metadados do Artigo/ }).click();
      const fields = {
        title: METADATA.title,
        authors: METADATA.authors,
        year: METADATA.year,
        doi: METADATA.doi,
        journal: METADATA.journal,
        volume: METADATA.volume,
        issue: METADATA.issue,
        pages: METADATA.pages,
      };
      for (const [name, value] of Object.entries(fields)) await window.locator(`input[name="${name}"]`).fill(value);

      // The preview is the box right above the "Copiar" button.
      const preview = window.getByRole('button', { name: 'Copiar' }).locator('xpath=preceding-sibling::div[1]');
      await expect(preview).toContainText('LIMA, Ana Beatriz');
      await expect(preview).toContainText(METADATA.shortTitle);
      await expect(preview).toContainText('2025');

      const saved = window.waitForEvent('dialog');
      await window.getByRole('button', { name: 'Salvar Metadados' }).click();
      expect((await saved).message()).toBe('Metadados salvos com sucesso!');

      // The toolbar title comes from the saved record.
      await expect(window.getByRole('banner').getByRole('heading', { level: 2 })).toHaveText(METADATA.title);
    } finally {
      await close();
    }
  });
});
