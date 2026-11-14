const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, navigateTo, openSettingsSection } = require('./helpers');
const { IMPORTED_TITLE, copyFixturePdf, importFixturePdf } = require('./articleFixture');

/**
 * Opens the mobile client the app serves, in a second window of the same Electron (CI has no other
 * browser). Its own session accepts the server's self-signed certificate, as a person does on the phone.
 */
async function openMobileClient(app, url) {
  const opening = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow, session }, target) => {
    const phone = session.fromPartition('e2e-phone');
    phone.setCertificateVerifyProc((_request, callback) => callback(0));
    const window = new BrowserWindow({ width: 390, height: 780, webPreferences: { session: phone } });
    void window.loadURL(target);
  }, url);
  const page = await opening;
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/** Whether pdf.js painted something on the first page's canvas (a blank canvas is all zeros). */
const firstPageIsDrawn = (phone) =>
  phone.evaluate(() => {
    const canvas = document.querySelector('.m-pdf-page canvas');
    if (!canvas || canvas.width <= 300) return false;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, Math.min(canvas.height, 400)).data;
    return pixels.some((value) => value !== 0);
  });

// #33: the phone pairs from the QR code's address, reads the library live (PDF included) and writes a diary
// page that the desktop then shows.
test('F-21 the mobile client pairs, reads a project and its PDF, and writes its diary', async () => {
  test.setTimeout(120000);
  const fixture = copyFixturePdf();
  const app = await launchApp({ E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath });
  const window = await getFirstWindow(app);
  await createProject(window, 'Tese no celular');
  await importFixturePdf(window);
  const projectUrl = window.url();
  await navigateTo(window, 'Configurações');
  await openSettingsSection(window, 'Acesso pelo celular');
  await window.getByRole('checkbox').check();
  await expect(window.locator('.remote-access-details')).toBeVisible();
  const invite = await window.evaluate(() => window.electronAPI.invoke('remoteAccess:startPairing'));

  // Same server and code as the QR code carries, reached on loopback: a CI runner's own LAN address is not
  // always routable from itself.
  const address = new URL(invite.url);
  address.hostname = '127.0.0.1';

  const phone = await openMobileClient(app, address.href);

  // Paired from the address alone; the code is gone from it afterwards.
  await expect(phone.getByText('Biblioteca do computador, ao vivo.')).toBeVisible({ timeout: 20000 });
  expect(phone.url()).not.toContain('pair=');
  await phone.getByText('Tese no celular').click();

  // The article imported on the desktop, and its PDF drawn by pdf.js under the page's content policy.
  await phone.getByText(IMPORTED_TITLE).click();
  await phone.getByRole('link', { name: 'Abrir PDF' }).click();
  await expect(phone.getByRole('figure', { name: 'Página 1' })).toBeVisible({ timeout: 20000 });
  await expect.poll(() => firstPageIsDrawn(phone), { timeout: 20000 }).toBe(true);
  await phone.getByRole('link', { name: 'Voltar' }).click();
  await phone.getByRole('link', { name: 'Voltar' }).click();

  await phone.getByRole('link', { name: 'Diário' }).click();
  await phone.getByLabel('Página de hoje').fill('Escrito no celular.');
  await phone.getByRole('button', { name: 'Salvar página' }).click();
  await expect(phone.getByText('Salvo no computador.')).toBeVisible();

  // A reload keeps the phone connected (the token is stored) and shows what was saved.
  await phone.reload();
  await expect(phone.getByLabel('Página de hoje')).toHaveValue('Escrito no celular.');

  // The desktop lists the phone and has the page in the project's diary.
  await window.reload();
  await navigateTo(window, 'Configurações');
  await openSettingsSection(window, 'Acesso pelo celular');
  await expect(window.locator('.backup-item')).toHaveCount(1);
  await window.goto(projectUrl);
  await window.getByTestId('tab-diary').click();
  await expect(window.getByText('Escrito no celular.')).toBeVisible({ timeout: 15000 });
  await app.close();
  fixture.cleanup();
});
