const { test } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');
const fs = require('fs');

// Throwaway: opens the app's windows and shoots each.
test('probe modals', async () => {
  test.setTimeout(240000);
  const out = process.env.PROBE_OUT;
  fs.mkdirSync(out, { recursive: true });
  const app = await launchApp({});
  const w = await getFirstWindow(app);
  const shot = async (name) => {
    await w.waitForTimeout(700);
    await w.screenshot({ path: `${out}/${name}.png` });
  };
  const esc = async () => {
    await w.keyboard.press('Escape');
    await w.waitForTimeout(300);
  };
  const tryDo = async (name, fn) => {
    try {
      await fn();
      await shot(name);
    } catch (e) {
      console.log('SKIP ' + name + ': ' + String(e).split('\n')[0]);
    }
    await esc();
    await esc();
  };
  try {
    await w.setViewportSize({ width: 1440, height: 900 });
    await createProject(w, 'Previsão Climática de Precipitação (Importado)');
    await clickAddArticlesOption(w, 'Artigo Manual');
    await shot('manual');
    await w.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', 'Convolutional LSTM Network');
    await w.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Shi, X.; Chen, Z.');
    await w.click('button[type="submit"]');
    await w.waitForTimeout(600);
    const id = (await w.evaluate(() => location.hash)).match(/projects\/(\d+)/)[1];
    await w.evaluate((r) => (location.hash = r), `/projects/${id}/articles`);
    await w.waitForTimeout(800);
    await tryDo('edit', async () => {
      await w
        .getByRole('button', { name: /Mais ações/ })
        .first()
        .click();
      await w
        .getByRole('menuitem', { name: /Editar/ })
        .first()
        .click();
    });
    await tryDo('cite', async () => {
      await w
        .getByRole('button', { name: /Mais ações/ })
        .first()
        .click();
      await w.getByRole('menuitem', { name: /Citar/ }).first().click();
    });
    await tryDo('archive', async () => {
      await w
        .getByRole('button', { name: /Mais ações/ })
        .first()
        .click();
      await w
        .getByRole('menuitem', { name: /Arquivar/ })
        .first()
        .click();
    });
    await tryDo('attach', async () => {
      await w
        .getByRole('button', { name: /Mais ações/ })
        .first()
        .click();
      await w.getByRole('menuitem', { name: /PDF/ }).first().click();
    });
    await tryDo('categories', async () => {
      await w.evaluate((r) => (location.hash = r), `/projects/${id}/categories`);
      await w.getByRole('button', { name: /Gerenciar categorias/ }).click();
    });
    await tryDo('quick-access', async () => {
      await w.evaluate((r) => (location.hash = r), `/projects/${id}/overview`);
      await w
        .getByRole('button', { name: /Gerenciar acesso rápido/ })
        .first()
        .click();
    });
    await tryDo('criteria', async () => {
      await w.evaluate((r) => (location.hash = r), `/projects/${id}/review`);
      await w
        .getByRole('button', { name: /Critérios/ })
        .first()
        .click();
    });
    await tryDo('labels', async () => {
      await w.evaluate((r) => (location.hash = r), `/projects/${id}/review`);
      await w
        .getByRole('button', { name: /rótulos/i })
        .first()
        .click();
    });
    await tryDo('venue', async () => {
      await w.evaluate((r) => (location.hash = r), `/agenda`);
      await w
        .getByRole('button', { name: /Novo evento/ })
        .first()
        .click();
    });
    await tryDo('changelog', async () => {
      await w.getByRole('button', { name: 'Novidades' }).click();
    });
    await tryDo('help', async () => {
      await w.getByRole('button', { name: /Ajuda/ }).first().click();
    });
    await tryDo('palette', async () => {
      await w.keyboard.press('Control+k');
    });
    await tryDo('confirm', async () => {
      await w.evaluate((r) => (location.hash = r), `/projects/${id}/overview`);
      await w
        .getByRole('button', { name: /Excluir|Apagar/ })
        .first()
        .click();
    });
    await tryDo('import', async () => {
      await w.evaluate((r) => (location.hash = r), `/projects/${id}/articles`);
      await clickAddArticlesOption(w, 'Importar de outro projeto');
    });
  } finally {
    await app.close();
  }
});
