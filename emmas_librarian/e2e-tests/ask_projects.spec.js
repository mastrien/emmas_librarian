const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow, createProject, navigateTo } = require('./helpers');
const { copyFixturePdf, importFixturePdf } = require('./articleFixture');

// E2E_MOCK_AI_ASK replaces only the AI providers (e2eAskModels): the fixture PDF is really read, cut, indexed and
// searched, and the conversation is really kept.
test('#53 a project is asked from the dashboard, and the answer survives a reload', async () => {
  const fixture = copyFixturePdf();
  const electronApp = await launchApp({ E2E_MOCK_AI_ASK: 'true', E2E_MOCK_OPEN_MULTIPLE_FILES: fixture.pdfPath });
  const window = await getFirstWindow(electronApp);

  try {
    const projectName = 'Perguntas ' + Date.now();
    await createProject(window, projectName);
    await importFixturePdf(window);

    await navigateTo(window, 'Projetos');
    await window.getByRole('link', { name: 'Perguntar aos projetos' }).click();
    await expect(window.getByRole('heading', { name: 'O que você quer saber?' })).toBeVisible();

    await window.getByRole('button', { name: '+ projeto' }).click();
    await window.getByRole('checkbox', { name: projectName }).click();
    await window.getByRole('heading', { name: 'O que você quer saber?' }).click();

    // Nothing indexed yet: the notice offers it, and goes away once it is done.
    const notice = window.getByText('1 PDF destes projetos ainda não entram nas respostas.');
    await expect(notice).toBeVisible();
    await expect(window.getByRole('textbox', { name: 'Sua pergunta' })).toHaveAttribute(
      'placeholder',
      'Nenhum PDF destes projetos está indexado com o modelo atual',
    );
    await window.getByRole('button', { name: 'Indexar agora' }).click();
    await expect(notice).toBeHidden({ timeout: 30000 });

    const box = window.getByRole('textbox', { name: 'Sua pergunta' });
    // Validation of epic #44: the box stood taller than the send button.
    const boxHeight = (await box.boundingBox()).height;
    const sendHeight = (await window.getByRole('button', { name: 'Enviar' }).boundingBox()).height;
    expect(Math.abs(boxHeight - sendHeight)).toBeLessThanOrEqual(1);
    await box.fill('Qual a amostra?');
    await box.press('Enter');

    // The statement citing a chunk that was not read stays, marked, with the notice to audit.
    await expect(window.getByText('Afirmação conferida E2E')).toBeVisible({ timeout: 15000 });
    const invented = window.locator('li', { hasText: 'Afirmação inventada E2E' });
    await expect(invented).toContainText('A IA citou 999');
    await expect(window.getByRole('note')).toContainText('1 ponto desta resposta não pôde ser conferido.');
    await expect(window.getByRole('link', { name: /Qual a amostra\?/ })).toBeVisible();

    // The citation opens the reader on its page, and the reader comes back to the conversation.
    await window.locator('.ask-cite').first().click();
    await window.getByRole('button', { name: /Abrir no leitor, página \d+/ }).click();
    await window.waitForURL(/.*\/articles\/\d+/);
    await window.getByRole('link', { name: 'Voltar à conversa' }).click();
    await window.waitForURL(/.*\/ask\/\d+/);

    // Kept for good: it costs tokens.
    await window.reload();
    await expect(window.getByText('Afirmação conferida E2E')).toBeVisible({ timeout: 15000 });
    await expect(window.getByText('Afirmação inventada E2E')).toBeVisible();
  } finally {
    await electronApp.close();
    fixture.cleanup();
  }
});
