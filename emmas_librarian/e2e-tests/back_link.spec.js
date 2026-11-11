const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject } = require('./helpers');
const { copyFixturePdf, importFixturePdf, openReader } = require('./articleFixture');

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

// Arca 134: nine "voltar" controls had six texts, four arrow sizes and borders on some. BackLink gives them one look,
// arrow with no fill and no border (design rule); the redesign left it on the reader only.
test('the back link of the reader looks the same, with no border and no fill', async () => {
  const fixture = copyFixturePdf();
  const electronApp = await launchApp({ E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Voltar ' + Date.now());
    // The project screens, the PDF library, "Perguntar aos projetos" and the terms lost their back links to the title
    // bar path, the sidebar and the module rail (redesign, boards 153-174): the reader's bar keeps one.
    await importFixturePdf(window);
    await openReader(window);
    const reference = await look(window.getByRole('link', { name: 'Voltar ao projeto' }));
    expect(reference).toMatchObject({ border: '0px', background: 'rgba(0, 0, 0, 0)', arrow: 18 });
  } finally {
    await electronApp.close();
    fixture.cleanup();
  }
});
