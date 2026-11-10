const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

async function addManualArticle(window, title) {
  await clickAddArticlesOption(window, 'Artigo Manual');
  await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', title);
  await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
  await window.click('button[type="submit"]');
}

// E2E_MOCK_AI_ASK replaces only the embedding provider (e2eAskModels): the vectors are stored, and the classifier, the
// queue and the simulation are real. The mock gives every text the same vector, so this checks the flow, not the order.
test('#55 turns the predicted order on, asking before generating, and simulates it', async () => {
  test.setTimeout(150000);
  const electronApp = await launchApp({ E2E_MOCK_AI_ASK: 'true' });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Ordem ' + Date.now());
    const titles = ['Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete'].map((n) => `Artigo ${n}`);
    for (const title of titles) await addManualArticle(window, title);
    await expect(window.getByTestId('main-articles-table').getByText('Artigo Sete')).toBeVisible();

    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await window.getByRole('link', { name: /Iniciar triagem guiada/ }).click();
    await expect(window.getByRole('heading', { name: 'Artigo Um', level: 2 })).toBeVisible();

    // Off by default, and turning it on asks before anything is sent.
    const toggle = window.getByRole('checkbox', { name: /Ordenar por relevância prevista/ });
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(window.getByText('Gerar os vetores de 7 artigos?')).toBeVisible();
    await window.getByRole('button', { name: 'Gerar e ordenar' }).click();
    await expect(window.getByText(/Faltam 3 relevantes e 3 excluídos/)).toBeVisible({ timeout: 15000 });

    // Three of each by the keyboard: 1 includes, 3 excludes; then the order begins, and nothing else was decided.
    for (const key of ['1', '1', '1', '3', '3', '3']) {
      await window.keyboard.press(key);
      await window.waitForTimeout(150);
    }
    await expect(window.getByText('Ordem prevista, aprendida com 6 decisões.')).toBeVisible({ timeout: 15000 });
    await expect(window.getByText(/Nos últimos 6 artigos, 3 relevantes/)).toBeVisible();
    await expect(window.getByRole('heading', { name: 'Artigo Sete', level: 2 })).toBeVisible();

    // The choice belongs to the project.
    await window.reload();
    await expect(window.getByRole('checkbox', { name: /Ordenar por relevância prevista/ })).toBeChecked({
      timeout: 15000,
    });

    // The guided screening is a focus mode since board 165: its way out is "Sair da triagem".
    await window.getByRole('link', { name: /Sair da triagem/ }).click();
    await window.getByRole('link', { name: 'Avaliar sugestões' }).click();
    await window.getByRole('button', { name: 'Simular' }).click();
    await expect(window.getByRole('row', { name: '6 3 3' })).toBeVisible({ timeout: 15000 });
  } finally {
    await electronApp.close();
  }
});
