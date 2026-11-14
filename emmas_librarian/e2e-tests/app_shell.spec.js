const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, getFirstWindow, createProject } = require('./helpers');

// Redesign, board 150: the header with "Mais opções" became a title bar with the path to the screen and a rail of
// module icons on the left.

const noHorizontalScroll = (window) =>
  window.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('the rail reaches every module and lights the one in use', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    const rail = window.getByRole('navigation', { name: 'Módulos' });

    await rail.getByRole('link', { name: 'Agenda', exact: true }).click();
    await expect(window).toHaveURL(/#\/agenda$/);
    await expect(rail.getByRole('link', { name: 'Agenda', exact: true })).toHaveAttribute('aria-current', 'page');

    await rail.getByRole('link', { name: 'Configurações', exact: true }).click();
    await expect(window).toHaveURL(/#\/settings$/);
    await expect(window.getByRole('navigation', { name: 'Caminho' })).toContainText('Configurações');

    await rail.getByRole('link', { name: 'Início', exact: true }).click();
    await expect(window).toHaveURL(/#\/$/);
  } finally {
    await electronApp.close();
  }
});

test('the title bar path names the project and leads back home', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);
  const name = 'Caminho ' + Date.now();

  try {
    await createProject(window, name);
    const path = window.getByRole('navigation', { name: 'Caminho' });
    await expect(path.getByText('Artigos')).toHaveAttribute('aria-current', 'page');
    await expect(path.getByRole('link', { name })).toBeVisible();

    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await expect(path.getByRole('link', { name })).toBeVisible();
    await expect(path.getByText('Triagem')).toHaveAttribute('aria-current', 'page');

    await path.getByRole('link', { name: 'Início' }).click();
    await expect(window).toHaveURL(/#\/$/);
  } finally {
    await electronApp.close();
  }
});

// The project tabs became sidebar sections with their own URL: a reload keeps the section and its lit item.
test('the project sidebar opens a section that survives a reload', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Seções ' + Date.now());
    const sidebar = window.getByRole('complementary', { name: 'Projeto' });
    await expect(window).toHaveURL(/#\/projects\/\d+\/articles$/);

    await sidebar.getByRole('link', { name: 'Diário' }).click();
    await expect(window).toHaveURL(/#\/projects\/\d+\/diary$/);
    await window.reload();

    await expect(sidebar.getByRole('link', { name: 'Diário' })).toHaveAttribute('aria-current', 'page');
    await expect(window.getByRole('navigation', { name: 'Caminho' }).getByText('Diário')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Artigos 0' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

// The sidebar keeps the recently opened quick access links on top; opening one is noted instead of launched.
test('quick access links added from the sidebar move up when opened', async () => {
  const openLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'emma-open-')), 'opened.log');
  const electronApp = await launchApp({ E2E_MOCK_OPEN_EXTERNAL_LOG: openLog });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Acesso rápido ' + Date.now());
    const quickAccess = window.getByRole('region', { name: 'Acesso rápido' });
    await quickAccess.getByRole('button', { name: 'Gerenciar acesso rápido' }).click();
    const dialog = window.getByRole('dialog', { name: 'Gerenciar Acesso Rápido' });
    for (const [title, url] of [
      ['Edital CAPES', 'https://exemplo.org/edital'],
      ['Planilha de reuniões', 'https://exemplo.org/planilha'],
    ]) {
      // Board 178: the list first, and "Link ou arquivo" opens the form; saving goes back to the list.
      await dialog.getByRole('button', { name: /Link ou arquivo/ }).click();
      await dialog.getByPlaceholder('Ex: Trello do Projeto, Edital CAPES').fill(title);
      await dialog.getByPlaceholder('https://').fill(url);
      await dialog.getByRole('button', { name: 'Adicionar' }).click();
      await expect(dialog.getByText(title)).toBeVisible();
    }
    await dialog.getByRole('button', { name: 'Fechar' }).click();

    const links = quickAccess.getByRole('button', { name: /Edital|Planilha/ });
    await expect(links).toHaveText(['Edital CAPES', 'Planilha de reuniões']);
    await quickAccess.getByRole('button', { name: 'Planilha de reuniões' }).click();

    await expect
      .poll(() => (fs.existsSync(openLog) ? fs.readFileSync(openLog, 'utf8') : ''))
      .toBe('https://exemplo.org/planilha\n');
    await expect(links).toHaveText(['Planilha de reuniões', 'Edital CAPES']);
    await window.reload();
    await expect(links).toHaveText(['Planilha de reuniões', 'Edital CAPES']);
  } finally {
    await electronApp.close();
    fs.rmSync(path.dirname(openLog), { recursive: true, force: true });
  }
});

// "Teclado primeiro" (redesign canvas): Ctrl+K goes anywhere, here to a section of the open project.
test('Ctrl+K opens the palette and Enter goes to what was typed', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Paleta ' + Date.now());
    await window.keyboard.press('Control+K');
    const palette = window.getByRole('dialog', { name: 'Ir para' });
    await palette.getByRole('combobox').fill('diario');
    await expect(palette.getByRole('option', { name: 'Diário' })).toHaveAttribute('aria-selected', 'true');
    await window.keyboard.press('Enter');

    await expect(window).toHaveURL(/#\/projects\/\d+\/diary$/);
    await expect(palette).toBeHidden();
  } finally {
    await electronApp.close();
  }
});

// A long project name must shrink with an ellipsis instead of pushing the page sideways, also on a narrow window.
test('a long project name never makes the window scroll sideways', async () => {
  const electronApp = await launchApp();
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(
      window,
      'Previsão climática de precipitação com aprendizado profundo em regiões tropicais ' + Date.now(),
    );
    await window.setViewportSize({ width: 900, height: 700 });

    expect(await noHorizontalScroll(window)).toBe(true);
    const bar = await window.locator('.app-titlebar').boundingBox();
    expect(bar.height).toBe(32);

    // Below 1200px the project sidebar folds to icons; its links keep their names.
    const sidebar = window.getByRole('complementary', { name: 'Projeto' });
    expect((await sidebar.boundingBox()).width).toBe(52);
    await expect(sidebar.getByRole('link', { name: 'Diário' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
