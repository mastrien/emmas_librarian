const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, navigateTo } = require('./helpers');

// The search mock answers a date-filtered query with one more article (E2eMockApiIntegrator), which is what
// separates a check from the search that started it.
test('#52 a marked search is checked on the dashboard, and what it finds is saved as its own entry', async () => {
  const electronApp = await launchApp({ E2E_MOCK_SEARCH: 'true' });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Monitorado ' + Date.now();
    await createProject(window, projectName);

    await window.click('text="Nova busca"');
    await window.fill('input[placeholder="Termo de busca..."]', 'aprendizado de maquina');
    await window.click('button:has-text("Fazer Busca")');
    const review = window.getByRole('dialog', { name: 'Busca Concluída' });
    await review.getByRole('button', { name: /Salvar .*no projeto/ }).click({ timeout: 10000 });
    await expect(window.locator('tr', { hasText: 'Aprendizado de Maquina E2E' })).toBeVisible({ timeout: 10000 });

    await window.getByTestId('tab-history').click();
    await window.getByRole('checkbox', { name: 'Monitorar esta busca' }).check();
    await expect(window.getByLabel('Intervalo da verificação')).toHaveValue('7');

    // Opening the dashboard runs the check: only what the project lacks counts.
    await navigateTo(window, 'Projetos');
    const notices = window.getByRole('region', { name: 'Novidades nas buscas monitoradas' });
    await expect(notices).toContainText(`1 artigo novo em ${projectName}`, { timeout: 10000 });

    await notices.getByRole('button', { name: 'Revisar' }).click();
    const found = review.getByRole('list', { name: 'Artigos encontrados' });
    await expect(found).toContainText('Artigo Monitorado E2E', { timeout: 10000 });
    await expect(found).not.toContainText('Aprendizado de Maquina E2E');
    await review.getByRole('button', { name: /Salvar .*no projeto/ }).click();
    await expect(review).toBeHidden();
    await expect(notices).toBeHidden();

    // The result is a new entry told apart from the search, which stays monitored.
    await window.getByText(projectName).click();
    await expect(window.locator('tr', { hasText: 'Artigo Monitorado E2E' })).toBeVisible({ timeout: 10000 });
    await window.getByTestId('tab-history').click();
    await expect(window.getByText('Resultado do monitoramento')).toBeVisible();
    await expect(window.getByText(/Monitoramento da busca #1/)).toBeVisible();
    await expect(window.getByRole('checkbox', { name: 'Monitorar esta busca' })).toBeChecked();
  } finally {
    await electronApp.close();
  }
});
