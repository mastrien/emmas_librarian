const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, clickAddArticlesOption } = require('./helpers');

// E2E_MOCK_AI_ASK replaces only the AI provider (e2eScreeningModel): the prompt, the reading of the answer, the saving
// and the screens are real.
test('#54 asks for a suggestion in the guided screening, decides, and measures it', async () => {
  test.setTimeout(120000);
  const electronApp = await launchApp({ E2E_MOCK_AI_ASK: 'true' });
  const window = await getFirstWindow(electronApp);

  try {
    await createProject(window, 'Sugestões ' + Date.now());
    await clickAddArticlesOption(window, 'Artigo Manual');
    await window.fill('input[placeholder="Ex: A New Approach to Bibliometrics"]', 'Artigo alfa');
    await window.fill('input[placeholder="Ex: John Doe, Jane Smith"]', 'Silva, A.');
    await window.fill('textarea[placeholder="Resumo do artigo..."]', 'Resumo com o trecho que sustenta a sugestão.');
    await window.click('button[type="submit"]');
    await expect(window.getByTestId('main-articles-table').getByText('Artigo alfa')).toBeVisible();

    await window.getByRole('link', { name: /Revisão sistemática/ }).click();
    await window.getByRole('link', { name: /Iniciar triagem guiada/ }).click();
    await expect(window.getByRole('heading', { name: 'Artigo alfa', level: 2 })).toBeVisible();

    // No criteria yet: it asks for them first.
    await window.getByRole('button', { name: 'Escrever os critérios' }).click();
    await window.getByRole('textbox', { name: 'Incluir quando' }).fill('Adultos em atenção primária');
    await window.getByRole('button', { name: 'Fechar os critérios' }).click();

    await window.getByRole('button', { name: 'Sugerir (S)' }).click();
    await expect(window.getByText('Justificativa E2E')).toBeVisible();
    await expect(window.locator('mark', { hasText: 'trecho que sustenta' })).toBeVisible();

    // The suggestion decided nothing: the person presses the usual button, marked as suggested.
    await expect(window.getByRole('button', { name: /Incluso/ })).toHaveAttribute('aria-pressed', 'false');
    await window.getByRole('button', { name: /sugerido/ }).click();
    await expect(window.getByRole('heading', { name: 'Triagem por título e resumo concluída' })).toBeVisible();

    // The evaluation reuses what was already answered, so it has nothing to pay for.
    await window.getByRole('link', { name: 'Voltar à revisão' }).click();
    await window.getByRole('link', { name: 'Avaliar sugestões' }).click();
    const row = window.getByRole('row', { name: /e2e\/mock/ });
    await expect(row).toContainText('100% (1 de 1)');
    await expect(window.getByRole('button', { name: 'Avaliar' })).toBeDisabled();

    // Kept for good: it cost tokens.
    await window.reload();
    await expect(window.getByRole('row', { name: /e2e\/mock/ })).toContainText('100% (1 de 1)', { timeout: 15000 });
  } finally {
    await electronApp.close();
  }
});
