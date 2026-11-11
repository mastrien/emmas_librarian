const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

const look = (locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      fontSize: style.fontSize,
      color: style.color,
      border: style.borderTopWidth,
      background: style.backgroundColor,
      arrow: Math.round(el.querySelector('svg').getBoundingClientRect().width),
    };
  });

// Arca 134: nine "voltar" controls had six texts, four arrow sizes and borders on some. Every page now uses BackLink:
// one look, arrow with no fill and no border (design rule).
test('every back link looks the same, with no border and no fill', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Voltar ' + Date.now());
    // The project screens lost their back links to the title bar path and the sidebar (redesign, boards 153-164), and
    // "Perguntar aos projetos" to the module rail (board 168): the PDF library and the terms keep theirs.
    await window.getByRole('link', { name: 'Biblioteca de PDFs' }).click();
    const reference = await look(window.getByRole('link', { name: 'Voltar aos projetos' }));
    expect(reference).toMatchObject({ border: '0px', background: 'rgba(0, 0, 0, 0)', arrow: 18 });

    await window.getByRole('link', { name: 'Início', exact: true }).click();
    await window.getByRole('link', { name: /Termos de Uso/ }).click();
    expect(await look(window.getByRole('link', { name: 'Voltar aos projetos' }))).toEqual(reference);
  } finally {
    await electronApp.close();
  }
});
