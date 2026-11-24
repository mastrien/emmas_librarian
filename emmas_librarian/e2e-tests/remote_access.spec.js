const { test, expect } = require('@playwright/test');
const https = require('https');
const {
  launchApp,
  getFirstWindow,
  createProject,
  navigateTo,
  openSettingsSection,
  answerAppDialog,
} = require('./helpers');

/** One HTTPS call to the app's LAN server; the certificate is self-signed, so it is checked by fingerprint. */
function call(port, method, route, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
    const options = { host: '127.0.0.1', port, method, path: route, headers, rejectUnauthorized: false };
    const request = https.request(options, (response) => {
      const fingerprint = response.socket.getPeerCertificate().fingerprint256;
      let text = '';
      response.on('data', (chunk) => (text += chunk));
      response.on('end', () => resolve({ status: response.statusCode, json: JSON.parse(text), fingerprint }));
    });
    request.on('error', reject);
    request.end(body ? JSON.stringify(body) : '');
  });
}

// #32: the LAN server is off until turned on in the settings; a phone pairs with a one-time code, reads the
// library with its own token, cannot reach the settings, and stops working when revoked.
test('F-20 a paired device reads the library over HTTPS until it is revoked', async () => {
  test.setTimeout(120000);
  const app = await launchApp();
  const window = await getFirstWindow(app);
  await createProject(window, 'Tese pelo celular');
  await navigateTo(window, 'Configurações');
  await openSettingsSection(window, 'Acesso pelo celular');

  await window.getByRole('checkbox').check();
  const address = await window.locator('.remote-access-details dd').first().innerText();
  const shownFingerprint = await window.locator('.remote-access-fingerprint').innerText();
  const port = Number(new URL(address).port);

  // The server presents the certificate whose fingerprint the screen shows.
  const ping = await call(port, 'GET', '/api/ping');
  expect(ping.json).toEqual({ ok: true, result: { app: 'emmas-librarian' } });
  expect(ping.fingerprint).toBe(shownFingerprint);
  expect((await call(port, 'POST', '/api/commands/projects:getAll')).status).toBe(401);

  // The code is what the QR code on screen carries; the spec reads it from the same call the screen makes.
  await window.getByRole('button', { name: /Parear um celular/ }).click();
  await expect(window.getByAltText('Código QR de pareamento')).toBeVisible();
  const invite = await window.evaluate(() => window.electronAPI.invoke('remoteAccess:startPairing'));
  const code = invite.url.split('#pair=')[1];
  const paired = await call(port, 'POST', '/api/pair', { body: { code, deviceName: 'Celular do E2E' } });
  const { token } = paired.json.result;
  expect((await call(port, 'POST', '/api/pair', { body: { code, deviceName: 'Outro' } })).status).toBe(403);

  const projects = await call(port, 'POST', '/api/commands/projects:getAll', { token });
  expect(projects.json.result.map((project) => project.name)).toEqual(['Tese pelo celular']);
  const keys = await call(port, 'POST', '/api/commands/settings:get', { token, body: { args: ['api_key_openai'] } });
  expect(keys.status).toBe(403);

  // The paired phone shows up when the code is closed, and revoking it cuts its token at once.
  await window.getByRole('button', { name: /Fechar código/ }).click();
  await expect(window.getByText('Celular do E2E')).toBeVisible();
  await window.getByRole('button', { name: 'Revogar' }).click();
  await answerAppDialog(window, 'Revogar celular', 'Revogar');
  await expect(window.getByText('Nenhum celular pareado.')).toBeVisible();
  expect((await call(port, 'POST', '/api/commands/projects:getAll', { token })).status).toBe(401);

  // Turned off, the port closes.
  await window.getByRole('checkbox').uncheck();
  await expect(window.locator('.remote-access-details')).toHaveCount(0);
  await expect(call(port, 'GET', '/api/ping')).rejects.toThrow();
  await app.close();
});
