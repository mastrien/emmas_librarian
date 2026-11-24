// The phone client in a real browser against a real desktop sync stack: pair with the code, copy the library, write
// offline, and let the computer decide (dry run). See mobile/e2e/syncServer.ts and docs/sincronizacao-celular.md.
const { test, expect } = require('@playwright/test');
const { METADATA } = require('../../e2e-tests/fixtures/articleContent.cjs');

test.beforeEach(({ request }) => control(request, 'POST', 'reset'));

const control = (request, method, route, data) =>
  request.fetch(`/__test/${route}`, { method, data }).then((response) => response.json());

/** Opens the phone's own library (the app mode) and goes to Ajustes. */
async function openAjustes(page) {
  await page.goto('/?local=1');
  await expect(page.getByRole('heading', { name: 'Projetos' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
}

/** Makes the computer unreachable (the phone out of the Wi-Fi) without breaking the app's own files. */
const unreachable = (page) => page.route('**/api/sync/**', (route) => route.abort());
const reachable = (page) => page.unroute('**/api/sync/**');

/** Taps "Sincronizar agora" and waits until the round trip is over (the button is back). */
async function syncNow(page) {
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(page.getByRole('button', { name: 'Sincronizando…' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toBeEnabled();
}

async function pairAndSync(page, request) {
  await control(request, 'POST', 'seed');
  await openAjustes(page);
  await page.getByLabel('Código de pareamento').fill(await control(request, 'GET', 'offer'));
  await page.getByRole('button', { name: 'Parear' }).click();
  await expect(page.getByText(/Pareado com/)).toBeVisible();
  await syncNow(page);
  await expect(page.getByText(/Última troca: (?!nunca)/)).toBeVisible();
}

test('the opening screen shows the name and logo, then the projects', async ({ page }) => {
  await page.goto('/?local=1');
  await expect(page.getByRole('heading', { name: "Emma's Librarian" })).toBeVisible();
  await expect(page.getByAltText("Logo do Emma's Librarian")).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Projetos' })).toBeVisible({ timeout: 15000 });
});

test('uses the desktop’s fonts and tokens, and its appearance choices', async ({ page }) => {
  await openAjustes(page);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Lexend');
  await page.getByRole('button', { name: 'Escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Rosa' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'pink');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'pink');
});

test('pairs, copies the computer’s library, and keeps it after a reload', async ({ page, request }) => {
  await pairAndSync(page, request);
  await page.getByRole('link', { name: 'Projetos' }).click();
  await expect(page.getByRole('link', { name: /Revisão sistemática/ })).toContainText('Sincronizado');

  await page.reload();
  await expect(page.getByRole('link', { name: /Revisão sistemática/ })).toBeVisible({ timeout: 15000 });
});

test('a diary page written offline reaches the computer only after the person applies it', async ({
  page,
  request,
}) => {
  await pairAndSync(page, request);
  await page.getByRole('link', { name: 'Projetos' }).click();
  await page.getByRole('link', { name: /Revisão sistemática/ }).click();
  await page.getByRole('link', { name: 'Diário' }).click();

  await unreachable(page);
  await page.getByLabel('Página de hoje').fill('Escrito no ônibus, sem rede.');
  await page.getByRole('button', { name: 'Salvar página' }).click();
  await expect(page.getByText('Salvo no celular.')).toBeVisible();
  // Closing and reopening the app: the page is on the phone, still waiting for the computer.
  await page.goto('/?local=1#/settings');
  await syncNow(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText(/1 alteração\(ões\) aguardando confirmação/)).toBeVisible();

  await page.getByRole('link', { name: 'Projetos' }).click();
  await expect(page.getByText(/1 aguardando o computador/)).toBeVisible();
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await reachable(page);
  await syncNow(page);
  await expect(page.getByText(/1 alteração\(ões\) aguardando confirmação no computador/)).toBeVisible();

  let state = await control(request, 'GET', 'state');
  expect(state.diary.map((entry) => entry.content)).toEqual(['Escrito no computador.']);
  expect(await control(request, 'GET', 'pending')).toHaveLength(1);

  await control(request, 'POST', 'apply');
  await syncNow(page);
  await expect(page.getByText('Nada aguardando o computador.')).toBeVisible();
  state = await control(request, 'GET', 'state');
  expect(state.diary.map((entry) => entry.content).sort()).toEqual([
    'Escrito no computador.',
    'Escrito no ônibus, sem rede.',
  ]);
});

test('a change the person rejects is undone on the phone', async ({ page, request }) => {
  await pairAndSync(page, request);
  await page.getByRole('link', { name: 'Projetos' }).click();
  await page.getByRole('link', { name: /Revisão sistemática/ }).click();
  await page.getByRole('link', { name: 'Diário' }).click();
  await page.getByLabel('Página de hoje').fill('Vai ser rejeitado.');
  await page.getByRole('button', { name: 'Salvar página' }).click();
  await expect(page.getByText('Salvo no celular.')).toBeVisible();
  await page.getByRole('link', { name: 'Voltar' }).click();
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await syncNow(page);
  await expect(page.getByText(/1 alteração/)).toBeVisible();

  await control(request, 'POST', 'reject');
  await syncNow(page);
  await expect(page.getByText('Nada aguardando o computador.')).toBeVisible();

  await page.getByRole('link', { name: 'Projetos' }).click();
  await page.getByRole('link', { name: /Revisão sistemática/ }).click();
  await page.getByRole('link', { name: 'Diário' }).click();
  await expect(page.getByLabel('Página de hoje')).toHaveValue('');
});

test('downloads the PDF, reads it offline, and marks a passage that the computer then receives', async ({
  page,
  request,
}) => {
  await pairAndSync(page, request);
  await page.getByRole('link', { name: 'Projetos' }).click();
  await page.getByRole('link', { name: /Revisão sistemática/ }).click();
  await page.getByRole('link', { name: /Revisões sistemáticas assistidas/ }).click();
  await page.getByRole('button', { name: 'Baixar PDF para ler offline' }).click();
  await expect(page.getByText(/PDF no celular · /)).toBeVisible();

  await unreachable(page);
  await page.getByRole('link', { name: 'Abrir PDF' }).click();
  await expect(page.locator('.textLayer').getByText(METADATA.journal).first()).toBeVisible({ timeout: 20000 });

  // Select the journal's name in the text layer, as a finger would.
  await page.locator('.textLayer').getByText(METADATA.journal).first().dblclick();
  await expect(page.getByRole('toolbar', { name: 'Marcar trecho' })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar de azul' }).click();
  await expect(page.getByTestId('pdf-mark').first()).toBeVisible();
  await reachable(page);

  await page.goto('/?local=1#/settings');
  await syncNow(page);
  await expect(page.getByText(/aguardando confirmação no computador/)).toBeVisible();
  const pending = await control(request, 'GET', 'pending');
  expect(pending.map((change) => change.entity)).toContain('highlights');

  await control(request, 'POST', 'apply');
  const { highlights } = await control(request, 'GET', 'state');
  expect(highlights).toHaveLength(1);
  expect(highlights[0].color).toBe('lightblue');
  expect(JSON.parse(highlights[0].position_data).boundingRect.pageNumber).toBeGreaterThan(0);
});
