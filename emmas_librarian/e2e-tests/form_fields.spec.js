const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

// Arca 134: form fields come from TextField/TextArea/SelectField, which put the app's input look (.input-field) on
// every control. jsdom has no layout, so the manual article form checks that the look reaches the real window:
// label above the control, controls filling their column, one height and one border for all single-line fields.
test('the manual article form uses one field look, label above, full width', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Campos ' + Date.now());
    await clickAddArticlesOption(window, 'Artigo Manual');
    const dialog = window.locator('form').filter({ has: window.getByLabel('Ano') });

    const lines = ['DOI', 'Ano'].map((name) => dialog.getByLabel(name, { exact: true }));
    const looks = await Promise.all(
      lines.map((field) =>
        field.evaluate((el) => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const label = document.querySelector(`label[for="${el.id}"]`).getBoundingClientRect();
          const column = el.parentElement.getBoundingClientRect();
          return {
            height: Math.round(box.height),
            border: style.borderTopWidth,
            radius: style.borderTopLeftRadius,
            fontSize: style.fontSize,
            labelAbove: label.bottom <= box.top,
            fillsColumn: Math.abs(box.width - column.width) < 1,
          };
        }),
      ),
    );

    expect(looks[0]).toEqual(looks[1]);
    expect(looks[0]).toMatchObject({ border: '1px', fontSize: '16px', labelAbove: true, fillsColumn: true });
    expect(await dialog.getByLabel('Resumo').evaluate((el) => getComputedStyle(el).resize)).toBe('none');
  } finally {
    await electronApp.close();
  }
});
