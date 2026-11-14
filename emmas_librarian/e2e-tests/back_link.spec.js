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
    // The project page lost its "Voltar aos projetos" to the title bar path, and the search page its back link to the
    // sidebar (redesign, board 158); the inner screens keep theirs.
    await window.getByRole('link', { name: 'Revisão sistemática' }).click();
    const reference = await look(window.getByRole('link', { name: 'Voltar ao projeto' }));
    expect(reference).toMatchObject({ border: '0px', background: 'rgba(0, 0, 0, 0)', arrow: 18 });

    // The investigation lost its back link to the sidebar too (board 159); the PDF library keeps one.
    await window.getByRole('link', { name: 'Biblioteca de PDFs' }).click();
    expect(await look(window.getByRole('link', { name: 'Voltar aos projetos' }))).toEqual(reference);
  } finally {
    await electronApp.close();
  }
});
