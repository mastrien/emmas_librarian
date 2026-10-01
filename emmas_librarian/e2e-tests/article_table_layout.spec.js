const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

// The extreme cases that broke the layout: an unbreakable word in the title and a very long author list.
const URL_TITLE =
  'Dataset https://zenodo.org/records/1234567/files/precipitation_reanalysis_southamerica_1979-2023_daily.nc';
const EIGHTEEN_AUTHORS = Array.from({ length: 18 }, (_, i) => `Autor${i + 1}, A.`).join('; ');
// Few authors but long names, comma-separated as OpenAlex sends them: the one-line author list used to
// set the column's minimum width (the example project from the author overflowed by up to 233px).
const LONG_NAMES =
  'Joaquim Eduardo Albuquerque-Siqueira, Maria Fernanda Carvalho-Nogueira, Carlos Eduardo Robles-Mendonça, ' +
  'Beatriz Helena Vasconcelos-Pimentel, Ricardo Augusto Figueiredo-Lacerda';

async function addManualArticle(window, title, authors) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', authors);
  await window.click('button[type="submit"]');
}

async function setSidebar(window, open) {
  const sidebar = window.getByRole('complementary', { name: 'Filtros' });
  if ((await sidebar.isVisible()) !== open) await window.getByRole('button', { name: /^Filtros/ }).click();
  await expect(sidebar).toBeVisible({ visible: open });
}

// How far the table sticks out of its scroll container (0 or less = no horizontal scroll).
const tableOverflow = (window) =>
  window.evaluate(() => {
    const table = document.querySelector('[data-testid="main-articles-table"]');
    return table.scrollWidth - table.parentElement.clientWidth;
  });

test('the article table never needs a horizontal scroll, with the filters sidebar open or closed', async () => {
  test.setTimeout(120000);
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Layout da tabela ' + Date.now());
    await addManualArticle(window, URL_TITLE, EIGHTEEN_AUTHORS);
    await addManualArticle(window, 'Artigo curto', 'Silva, A.');
    await addManualArticle(window, 'Soft sensor para fermentação em escala industrial', LONG_NAMES);
    await expect(window.getByTestId('main-articles-table').getByText(/zenodo/)).toBeVisible();

    for (const width of [900, 1000, 1200, 1366]) {
      await electronApp.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 850), width);
      for (const open of [true, false]) {
        await setSidebar(window, open);
        await expect
          .poll(() => tableOverflow(window), { message: `${width}px, filtros ${open ? 'abertos' : 'fechados'}` })
          .toBeLessThanOrEqual(0);
      }
    }
  } finally {
    await electronApp.close();
  }
});
