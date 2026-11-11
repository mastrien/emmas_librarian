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
    // The project screens, the PDF library and "Perguntar aos projetos" lost their back links to the title bar path,
    // the sidebar and the module rail (redesign, boards 153-171): only the terms keep theirs (until board 174),
    // so this checks that one against the look the design rule asks for.
    await window.getByRole('link', { name: 'Início', exact: true }).click();
    await window.getByRole('link', { name: /Termos de Uso/ }).click();
    const reference = await look(window.getByRole('link', { name: 'Voltar aos projetos' }));
    expect(reference).toMatchObject({ border: '0px', background: 'rgba(0, 0, 0, 0)', arrow: 18 });
  } finally {
    await electronApp.close();
  }
});
