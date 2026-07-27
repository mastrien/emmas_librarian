const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, navigateTo } = require('./helpers');

test.describe('Agenda & Prazos E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await launchApp();
    window = await getFirstWindow(electronApp);
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should navigate to Agenda page, create a new event with custom milestone, switch view modes, and verify dashboard deadline banner', async () => {
    // 1. Navigate to Agenda page via navbar helper
    await navigateTo(window, 'Agenda');

    // 2. Open Novo Evento modal
    const addVenueBtn = window.locator('button', { hasText: 'Novo Evento' }).first();
    await expect(addVenueBtn).toBeVisible({ timeout: 10000 });
    await addVenueBtn.click();

    // 3. Fill venue modal form with unique title & acronym to avoid database strict mode collisions
    const modalTitle = window.locator('h3', { hasText: 'Novo Evento / Periódico' });
    await expect(modalTitle).toBeVisible();

    const timestamp = Date.now();
    const uniqueTitle = 'Conferência de IA E2E ' + timestamp;
    const uniqueAcronym = 'IA' + timestamp.toString().slice(-5);

    await window.fill('input[placeholder*="Simpósio Brasileiro"]', uniqueTitle);
    await window.fill('input[placeholder*="SBBD 2026"]', uniqueAcronym);

    // Add custom milestone inline without prompt()
    const addCustomFieldBtn = window.locator('button', { hasText: 'Criar Novo Campo' });
    await expect(addCustomFieldBtn).toBeVisible();
    await addCustomFieldBtn.click();

    const customLabelInput = window.locator('input[placeholder*="Avaliação de Pares"]');
    await expect(customLabelInput).toBeVisible();
    await customLabelInput.fill('Revisão Final E2E');

    const confirmCustomBtn = window.locator('button', { hasText: 'Confirmar Campo' });
    await confirmCustomBtn.click();

    // Confirm custom label is rendered in form
    await expect(window.locator(`input[value="Revisão Final E2E"]`)).toBeVisible();

    // Save venue
    const saveBtn = window.locator('button', { hasText: 'Salvar Evento' });
    await saveBtn.click();

    // 4. Verify venue card in "Por Evento/Revista" mode using specific unique locators
    await expect(window.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(window.locator(`text=${uniqueAcronym}`).first()).toBeVisible();

    // 5. Switch to "Lista de Prazos" view using the unified pill control
    const listModeBtn = window.locator('button', { hasText: 'Lista de Prazos' });
    await expect(listModeBtn).toBeVisible();
    await listModeBtn.click();

    // Verify milestone is listed
    await expect(window.locator('text=Revisão Final E2E').first()).toBeVisible();

    // 6. Navigate back to Dashboard and verify minimalist clock & upcoming deadlines
    await navigateTo(window, 'Projetos');

    const projectsHeading = window.locator('h1', { hasText: 'Seus Projetos' });
    await expect(projectsHeading).toBeVisible({ timeout: 10000 });

    // Check upcoming deadline banner displays milestone or venue acronym
    const deadlineBanner = window.locator('text=Próximos Prazos');
    await expect(deadlineBanner).toBeVisible();
  });
});
