import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  article,
  answer,
  failure,
  investigationService,
  record,
  renderInvestigation,
  setWindowWidth,
} from './investigationTestData';

beforeEach(() => {
  sessionStorage.clear();
  setWindowWidth(1600);
});
afterEach(() => setWindowWidth(1600));

const list = () => screen.getByRole('navigation', { name: 'Investigações do projeto' });

function reviewProject() {
  const results = [answer(1, 'Q1'), answer(1, 'Q2'), answer(2, 'Q1'), failure(2, 'Q2')];
  return { results, service: investigationService([article(1), article(2)], [record(14)], { 14: results }) };
}

describe('InvestigationPage (#73): where it opens', () => {
  it('opens the newest investigation, listed with its status, model and what is left to review', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation');

    expect(await screen.findByRole('heading', { name: /Investigação #14/ })).toBeInTheDocument();
    const card = within(list()).getByRole('link', { name: /#14/ });
    expect(card).toHaveTextContent('Sucesso');
    expect(card).toHaveTextContent('Ollama (gpt-oss:120b) · 2 artigos · 2 perguntas');
    await waitFor(() => expect(card).toHaveTextContent('3 para revisar'));
  });

  it('opens on a new investigation when the project has none, and says it in the list', async () => {
    renderInvestigation(investigationService([article(1)], []), '/projects/3/investigation');

    expect(await screen.findByRole('heading', { name: 'Nova investigação' })).toBeInTheDocument();
    expect(within(list()).getByText('Nenhuma investigação ainda.')).toBeInTheDocument();
  });

  it('shows the model of the next run and a way back to the project', async () => {
    const service = investigationService([article(1)], []);
    service.getAiModelConfigs.mockResolvedValue([
      { skill: 'extraction', provider: 'openai', model_name: 'gpt-4o-mini' },
    ] as never);
    renderInvestigation(service, '/projects/3/investigation');

    expect(await screen.findByText('OpenAI (gpt-4o-mini)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao projeto' })).toHaveAttribute('href', '/projects/3');
  });

  it('falls back to the list when the address names an investigation that does not exist', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/999');

    expect(await screen.findByRole('heading', { name: /Investigação #14/ })).toBeInTheDocument();
  });

  it('treats malformed stored questions or article ids as empty', async () => {
    const service = investigationService([], [record(14, { questions: '{oops', articles_ids: 'x' })]);
    renderInvestigation(service, '/projects/3/investigation/14');

    expect(
      await within(await screen.findByRole('navigation', { name: 'Investigações do projeto' })).findByText(
        /0 artigos · 0 perguntas/,
      ),
    ).toBeInTheDocument();
  });
});

describe('InvestigationPage (#73): answers', () => {
  it('starts on what is pending, as a grid, with the selected answer beside it', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    expect(await screen.findByRole('button', { name: 'Estudo 1, pergunta 1: pendente' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pendentes (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Estudo 2, pergunta 2/ })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary', { name: 'Resposta selecionada' })).getByText('Resposta de 1 a Q1'),
    ).toBeInTheDocument();
  });

  it('shows an error in the grid and its message in the panel, with nothing to review', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Com erro (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Estudo 2, pergunta 2: erro' }));

    const panel = screen.getByRole('complementary', { name: 'Resposta selecionada' });
    expect(within(panel).getByText(/401 chave recusada/)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Aceitar' })).not.toBeInTheDocument();
  });

  it('saves a review, moves on to the next pending answer and lets the marked one be undone', async () => {
    const { service, results } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar' }));

    await waitFor(() =>
      expect(service.reviewInvestigationResult).toHaveBeenCalledWith(results[0].id, { status: 'accepted' }),
    );
    expect(await screen.findByRole('button', { name: 'Estudo 1, pergunta 2: pendente' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pendentes (2)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revisadas (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Estudo 1, pergunta 1: aceita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() =>
      expect(service.reviewInvestigationResult).toHaveBeenLastCalledWith(results[0].id, { status: 'pending' }),
    );
  });

  it('marks with the keyboard once an answer is chosen, and walks with the arrows', async () => {
    const { service, results } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Estudo 1, pergunta 2: pendente' }));
    const controls = await screen.findByLabelText(/Revisão da resposta/);
    await waitFor(() => expect(controls).toHaveFocus());
    fireEvent.keyDown(controls, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Estudo 2, pergunta 1: pendente' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const next = await screen.findByLabelText(/Revisão da resposta/);
    await waitFor(() => expect(next).toHaveFocus());
    fireEvent.keyDown(next, { key: 'r' });
    await waitFor(() =>
      expect(service.reviewInvestigationResult).toHaveBeenCalledWith(results[2].id, { status: 'rejected' }),
    );
  });

  it('narrows the grid to one question', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.change(await screen.findByLabelText('Pergunta'), { target: { value: 'Q2' } });

    expect(screen.getByRole('button', { name: 'Estudo 1, pergunta 1: pendente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pergunta 2/ })).not.toBeInTheDocument();
  });

  it('opens the evidence in the reader, remembering the way back', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar no Documento' }));

    const where = JSON.parse((await screen.findByTestId('where')).textContent ?? '{}');
    expect(where.path).toBe('/articles/1');
    expect(where.state).toMatchObject({
      searchQuery: 'trecho citado',
      page: 4,
      backTo: { path: '/projects/3/investigation/14', label: 'Voltar à investigação' },
    });
  });

  it('still shows an answer stored as plain text by an older version', async () => {
    const service = investigationService([article(1)], [record(14)], {
      14: [answer(1, 'Q1', { answer: 'Coorte antiga' })],
    });
    renderInvestigation(service, '/projects/3/investigation/14');

    expect(await screen.findAllByText('Coorte antiga')).not.toHaveLength(0);
  });
});

describe('InvestigationPage (#73): calls', () => {
  it('groups the errors by message and runs those articles again in a new investigation', async () => {
    const results = [
      answer(1, 'Q1'),
      answer(1, 'Q2'),
      failure(2, 'Q1'),
      failure(2, 'Q2'),
      failure(3, 'Q1'),
      failure(3, 'Q2'),
    ];
    const service = investigationService([article(1), article(2), article(3)], [record(14)], { 14: results });
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('tab', { name: /Chamadas/ }));
    const group = screen.getByRole('alert');
    expect(group).toHaveTextContent('4 chamadas com erro');
    expect(group).toHaveTextContent('401 chave recusada');
    expect(screen.getByText('6 de 6')).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Refazer estes 2 artigos' }));

    expect(await screen.findByRole('heading', { name: 'Nova investigação' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Q1')).toBeInTheDocument();
    expect(screen.getByText('2 artigos × 2 perguntas = 4 respostas')).toBeInTheDocument();
  });

  it('opens on the calls when every call failed, since there is nothing to review', async () => {
    const service = investigationService([article(1)], [record(14, { status: 'Falhou' })], {
      14: [failure(1, 'Q1'), failure(1, 'Q2')],
    });
    renderInvestigation(service, '/projects/3/investigation/14');

    await waitFor(() => expect(screen.getByRole('tab', { name: /Chamadas/ })).toHaveAttribute('aria-selected', 'true'));
    expect(within(list()).getByText('Falhou')).toBeInTheDocument();
  });
});

describe('InvestigationPage (#73): a new investigation', () => {
  const start = async (service: ReturnType<typeof investigationService>) => {
    renderInvestigation(service, '/projects/3/investigation/new');
    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: 'Qual o desenho?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar investigação' }));
  };

  it('explains when no article has a PDF', async () => {
    renderInvestigation(
      investigationService([{ ...article(1), local_file_path: null } as never], []),
      '/projects/3/investigation/new',
    );

    expect(await screen.findByText('Nenhum artigo com PDF vinculado encontrado neste projeto.')).toBeInTheDocument();
  });

  it('says how many answers it will ask for, and cannot start without a question', async () => {
    renderInvestigation(investigationService([article(1), article(2)], []), '/projects/3/investigation/new');

    expect(await screen.findByRole('button', { name: 'Iniciar investigação' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Pergunta 1'), { target: { value: 'Q' } });
    expect(screen.getByText('2 artigos × 1 perguntas = 2 respostas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar investigação' })).toBeEnabled();
  });

  it('keeps one empty question when the last one is removed', async () => {
    renderInvestigation(investigationService([article(1)], []), '/projects/3/investigation/new');

    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: 'Q' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remover a pergunta 1' }));

    expect(screen.getByPlaceholderText('Pergunta 1')).toHaveValue('');
  });

  it('shows the run as it goes, then opens what it saved', async () => {
    let finish: (rows: never[]) => void = () => undefined;
    const service = investigationService([article(1)], []);
    service.massiveExtraction.mockImplementation(() => new Promise((resolve) => (finish = resolve as never)));
    service.saveMassiveInvestigation.mockImplementation(async () => {
      service.getMassiveInvestigations.mockResolvedValue([
        record(21, { questions: JSON.stringify(['Qual o desenho?']) }),
      ] as never);
      return 21;
    });
    await start(service);

    expect(await screen.findByRole('heading', { name: /Investigação em andamento/ })).toHaveTextContent(
      'Artigo 1 de 1',
    );
    expect(screen.getByRole('img', { name: 'Estudo 1, Qual o desenho?: rodando' })).toBeInTheDocument();
    await act(async () => finish([]));

    expect(await screen.findByRole('heading', { name: /Investigação #21/ })).toBeInTheDocument();
    expect(service.saveMassiveInvestigation.mock.calls[0][0]).toBe(3);
  });

  it('shows a failing article while the run goes on', async () => {
    let finish: (rows: never[]) => void = () => undefined;
    const service = investigationService([article(1), article(2)], []);
    service.massiveExtraction
      .mockRejectedValueOnce(new Error('401 chave recusada'))
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve as never)));
    await start(service);

    expect(await screen.findByRole('alert')).toHaveTextContent('401 chave recusada');
    expect(screen.queryByRole('button', { name: /Refazer/ })).not.toBeInTheDocument();
    await act(async () => finish([]));
  });

  it('cancels at the next article and saves the rest as skipped', async () => {
    let finish: (rows: never[]) => void = () => undefined;
    const service = investigationService([article(1), article(2)], []);
    service.massiveExtraction.mockImplementation(() => new Promise((resolve) => (finish = resolve as never)));
    await start(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await act(async () => finish([]));

    await waitFor(() => expect(service.saveInvestigationResults).toHaveBeenCalledTimes(2));
    expect(service.massiveExtraction).toHaveBeenCalledTimes(1);
    expect(service.saveInvestigationResults.mock.calls[1][2][0]).toMatchObject({ status: 'skipped' });
  });

  it('warns when the quota ran out', async () => {
    const service = investigationService([article(1)], []);
    service.massiveExtraction.mockRejectedValue(new Error('429 QUOTA_EXCEEDED'));
    await start(service);

    expect(await screen.findByRole('alertdialog', { name: 'Limite de Cota Atingido' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

describe('InvestigationPage (#73): side panels', () => {
  it('collapses the list beside the content on a wide window', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Recolher a lista de investigações' }));
    expect(screen.queryByRole('navigation', { name: 'Investigações do projeto' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar a lista de investigações' }));
    expect(list()).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('on a narrow window the list is a drawer on the left, closed by choosing an investigation', async () => {
    setWindowWidth(1000);
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar a lista de investigações' }));
    const drawer = screen.getByRole('dialog', { name: 'Investigações do projeto' });
    expect(drawer).toHaveClass('side-drawer--left');
    fireEvent.click(within(drawer).getByRole('link', { name: /#14/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('on a narrow window the answer opens only when asked for, as a drawer on the right', async () => {
    setWindowWidth(1000);
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    const cell = await screen.findByRole('button', { name: 'Estudo 1, pergunta 1: pendente' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(cell);
    const drawer = screen.getByRole('dialog', { name: 'Resposta selecionada' });
    expect(drawer).toHaveClass('side-drawer--right');
    expect(within(drawer).getByText('Resposta de 1 a Q1')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
