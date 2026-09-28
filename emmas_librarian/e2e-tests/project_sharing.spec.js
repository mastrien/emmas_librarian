const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, getFirstWindow, createProject } = require('./helpers');
const { IMPORTED_TITLE, copyFixturePdf, importFixturePdf, openReader } = require('./articleFixture');

// Export in one installation, delete it, import in another: the PDF must travel inside the .emmapcarc.
test('F-17 a project shared as .emmapcarc opens in another installation with its PDF', async () => {
  test.setTimeout(180000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-sharing-'));
  const packagePath = path.join(root, 'tese.emmapcarc');
  const senderData = path.join(root, 'remetente');
  const fixture = copyFixturePdf();
  const env = {
    E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath,
    E2E_MOCK_SAVE_FILE_PATH: packagePath,
    E2E_MOCK_PROJECT_FILE: packagePath,
  };

  try {
    const sender = await launchApp(env, { userDataDir: senderData });
    try {
      const window = await getFirstWindow(sender);
      await createProject(window, 'Projeto Compartilhado');
      await importFixturePdf(window);

      // The menu opens on hover; a click after the hover would toggle it closed again.
      await window.getByRole('button', { name: 'Exportar', exact: true }).hover();
      const confirmation = window.waitForEvent('dialog');
      await window.getByRole('button', { name: /Pacote \.emmapcarc/ }).click();
      expect((await confirmation).message()).toBe(`Pacote .emmapcarc exportado com sucesso para: ${packagePath}`);
    } finally {
      await sender.close();
    }
    // Nothing of the sender's installation may be needed to open the shared project.
    fs.rmSync(senderData, { recursive: true, force: true });
    fixture.cleanup();

    const receiver = await launchApp(env, { userDataDir: path.join(root, 'destinatario') });
    try {
      const window = await getFirstWindow(receiver);
      await window.getByTitle('Importar projeto (.emmapcarc)').click();

      await expect(window.getByRole('heading', { name: 'Projeto Compartilhado (Importado)' })).toBeVisible({
        timeout: 15000,
      });
      await expect(window.locator('table').getByText(IMPORTED_TITLE)).toBeVisible();
      await openReader(window);
    } finally {
      await receiver.close();
    }
  } finally {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
