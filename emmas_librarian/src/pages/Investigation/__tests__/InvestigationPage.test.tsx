import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  article,
  answer,
  failure,
  goToStep,
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
  // Board 159: the sidebar line is short (number, date, what is left to review); the rest is in its tooltip.
  it('opens the newest investigation, listed with what is left to review and the details in its tooltip', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation');

    expect(await screen.findByRole('heading', { name: /Investigação #14/ })).toBeInTheDocument();
    const item = within(list()).getByRole('link', { name: /#14/ });
    await waitFor(() => expect(item).toHaveTextContent(/3$/));
    expect(item).toHaveAttribute('title', 'Sucesso · Ollama (gpt-oss:120b) · 2 artigos · 2 perguntas · 3 para revisar');
    expect(item).toHaveAttribute('aria-current', 'page');
  });

  // #84: measured at mount the page was still loading, so it had no height until the window was resized.
  it('takes its height from the window as soon as it appears, with no resize', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    const page = await screen.findByTestId('investigation-page');

    // The class reads it as height: var(--fill-height); jsdom does not resolve variables, so the variable is checked.
    expect(page.style.getPropertyValue('--fill-height')).toBe(`${window.innerHeight}px`);
  });

  it('opens on a new investigation when the project has none, and says it in the list', async () => {
    renderInvestigation(investigationService([article(1)], []), '/projects/3/investigation');

    expect(await screen.findByRole('heading', { name: 'Nova investigação' })).toBeInTheDocument();
    expect(within(list()).getByText('Nenhuma investigação ainda.')).toBeInTheDocument();
  });

  it('shows the model of the next run on its step', async () => {
    const service = investigationService([article(1)], []);
    service.getAiModelConfigs.mockResolvedValue([
      { skill: 'extraction', provider: 'openai', model_name: 'gpt-4o-mini' },
    ] as never);
    renderInvestigation(service, '/projects/3/investigation');
    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: 'Q' } });

    goToStep('Modelo e custo');

    expect(await screen.findByText('OpenAI (gpt-4o-mini)')).toBeInTheDocument();
  });

  it('falls back to the list when the address names an investigation that does not exist', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/999');

    expect(await screen.findByRole('heading', { name: /Investigação #14/ })).toBeInTheDocument();
  });

  it('treats malformed stored questions or article ids as empty', async () => {
    const service = investigationService([], [record(14, { questions: '{oops', articles_ids: 'x' })]);
    renderInvestigation(service, '/projects/3/investigation/14');

    const item = await within(await screen.findByRole('navigation', { name: 'Investigações do projeto' })).findByRole(
      'link',
      { name: /#14/ },
    );
    expect(item.getAttribute('title')).toContain('0 artigos · 0 perguntas');
  });
});

describe('InvestigationPage (#73): answers', () => {
  // Board 162: how much was reviewed replaces the line of shortcuts, and the panel says where the answer sits.
  it('shows how many answers were reviewed and where the selected one sits in the list', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    const panel = await screen.findByRole('complementary', { name: 'Resposta selecionada' });
    expect(panel).toHaveTextContent('1/3');
    expect(screen.getByText('0 de 3').parentElement).toHaveTextContent('Revisadas 0 de 3');
    expect(screen.getByRole('progressbar', { name: 'Respostas revisadas' })).toHaveAttribute('value', '0');
  });

  it('starts on what is pending, as a grid, with the selected answer beside it', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    expect(await screen.findByRole('button', { name: 'Estudo 1, pergunta 1: pendente' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pendentes 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Estudo 2, pergunta 2/ })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary', { name: 'Resposta selecionada' })).getByText('Resposta de 1 a Q1'),
    ).toBeInTheDocument();
  });

  it('shows an error in the grid and its message in the panel, with nothing to review', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    fireEvent.click(await screen.findByRole('button', { name: 'Com erro 1' }));
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
    expect(screen.getByRole('button', { name: 'Pendentes 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revisadas 1' }));
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

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir no PDF' }));

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
    expect(screen.getByText('6 chamadas · 2 com resposta, 4 sem')).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: 'Refazer estes 2 artigos' }));

    expect(await screen.findByRole('heading', { name: 'Nova investigação' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Q1')).toBeInTheDocument();
    goToStep('Modelo e custo');
    expect(screen.getByText('2 artigos × 2 perguntas = 4 respostas')).toBeInTheDocument();
  });

  it('opens on the calls when every call failed, since there is nothing to review', async () => {
    const service = investigationService([article(1)], [record(14, { status: 'Falhou' })], {
      14: [failure(1, 'Q1'), failure(1, 'Q2')],
    });
    renderInvestigation(service, '/projects/3/investigation/14');

    await waitFor(() => expect(screen.getByRole('tab', { name: /Chamadas/ })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('heading', { name: /Investigação #14/ })).toHaveTextContent('Falhou');
  });
});

describe('InvestigationPage: the calls as a list (board 161)', () => {
  it('lists every call, filters the failed ones and shows the chosen one beside the list', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');
    fireEvent.click(await screen.findByRole('tab', { name: /Chamadas/ }));

    expect(within(screen.getByRole('table', { name: 'Chamadas' })).getAllByRole('row')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Com erro 1' }));
    const rows = within(screen.getByRole('table', { name: 'Chamadas' })).getAllByRole('row');
    expect(rows).toHaveLength(2);
    fireEvent.click(within(rows[1]).getByRole('button'));

    const detail = screen.getByRole('complementary', { name: 'Chamada selecionada' });
    expect(detail).toHaveTextContent('Chamada 4');
    expect(detail).toHaveTextContent('401 chave recusada');
  });

  it('narrows the list to one question', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');
    fireEvent.click(await screen.findByRole('tab', { name: /Chamadas/ }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Pergunta' }), { target: { value: 'Q2' } });

    const rows = within(screen.getByRole('table', { name: 'Chamadas' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((r) => (r as HTMLTableRowElement).cells[0].textContent)).toEqual(['2', '4']);
  });
});

describe('InvestigationPage (#73): a new investigation', () => {
  const start = async (service: ReturnType<typeof investigationService>) => {
    renderInvestigation(service, '/projects/3/investigation/new');
    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: 'Qual o desenho?' } });
    goToStep('Executar');
    // The start first asks what indexing would do, so the run only begins after that answer.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar investigação' }));
    });
  };

  it('explains when no article has a PDF', async () => {
    renderInvestigation(
      investigationService([{ ...article(1), local_file_path: null } as never], []),
      '/projects/3/investigation/new',
    );

    expect(await screen.findByText('Nenhum artigo com PDF vinculado encontrado neste projeto.')).toBeInTheDocument();
  });

  // Board 159: Perguntas, Artigos, Modelo e custo, Executar; a step opens once the ones before it are complete.
  it('cannot go past the questions without one, then says how many answers it will ask for', async () => {
    renderInvestigation(investigationService([article(1), article(2)], []), '/projects/3/investigation/new');

    expect(await screen.findByRole('button', { name: /Próximo: artigos/ })).toBeDisabled();
    expect(screen.getByText('Escreva pelo menos uma pergunta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Executar' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Pergunta 1'), { target: { value: 'Q' } });
    fireEvent.click(screen.getByRole('button', { name: /Próximo: artigos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Próximo: modelo e custo/ }));

    expect(screen.getByText('2 artigos × 1 perguntas = 2 respostas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Próximo: executar/ }));
    expect(screen.getByRole('button', { name: 'Iniciar investigação' })).toBeEnabled();
  });

  it('starts the questions from the newest investigation', async () => {
    renderInvestigation(
      investigationService([article(1)], [record(14, { questions: JSON.stringify(['Onde?', 'Quando?']) })]),
      '/projects/3/investigation/new',
    );

    fireEvent.click(await screen.findByRole('button', { name: /Da investigação #14/ }));

    expect(screen.getByDisplayValue('Onde?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Quando?')).toBeInTheDocument();
  });

  it('keeps what was chosen when going back a step', async () => {
    renderInvestigation(investigationService([article(1)], []), '/projects/3/investigation/new');
    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: 'Qual o desenho?' } });
    goToStep('Artigos');

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.getByDisplayValue('Qual o desenho?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perguntas' })).toHaveAttribute('aria-current', 'step');
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

    expect(await screen.findByRole('heading', { name: /Investigação\s+Rodando/ })).toBeInTheDocument();
    expect(screen.getByText('Indexar os PDFs').closest('li')).toHaveTextContent('0 de 1');
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

  // Board 160: how many calls are done, which article is being asked, and a way to leave while it runs.
  it('counts the calls done and lets the person leave while the run goes on', async () => {
    let finish: (rows: never[]) => void = () => undefined;
    const service = investigationService([article(1)], []);
    service.massiveExtraction.mockImplementation(() => new Promise((resolve) => (finish = resolve as never)));
    await start(service);

    const progress = await screen.findByRole('region', { name: 'Progresso' });
    expect(progress).toHaveTextContent('0 de 1 chamadas');
    expect(progress).toHaveTextContent('Agora: Estudo 1');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar em segundo plano' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/projects/3/articles');
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

    expect(await screen.findByRole('dialog', { name: 'Limite de Cota Atingido' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('InvestigationPage: the embedding model changed', () => {
  const plan = (extra = {}) => ({
    pending: 1,
    outdated: 1,
    sizeChanged: false,
    othersLosingVectors: 0,
    previousModel: null,
    ...extra,
  });

  const start = async (service: ReturnType<typeof investigationService>) => {
    renderInvestigation(service, '/projects/3/investigation/new');
    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: 'Qual o desenho?' } });
    goToStep('Executar');
    // The start first asks what indexing would do, so the run only begins after that answer.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar investigação' }));
    });
  };

  it('asks nothing when no PDF is outdated', async () => {
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockResolvedValue(plan({ outdated: 0 }));
    await start(service);

    await waitFor(() => expect(service.massiveExtraction).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(service.indexAskMissing).not.toHaveBeenCalled();
  });

  it('says going back to the previous model spares recalculating', async () => {
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockResolvedValue(plan({ previousModel: 'ollama/nomic-embed-text' }));
    await start(service);

    expect(await screen.findByTestId('previous-model')).toHaveTextContent('nomic-embed-text (Ollama)');
  });

  it('recalculates only what was picked, then runs, when the person agrees', async () => {
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockResolvedValue(plan());
    await start(service);

    const dialog = await screen.findByRole('dialog', { name: 'Recalcular os PDFs' });
    expect(dialog).toHaveTextContent('1 PDF precisa ser calculado');
    expect(dialog).toHaveTextContent('consome tokens');
    expect(service.massiveExtraction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Recalcular e investigar' }));

    await waitFor(() => expect(service.massiveExtraction).toHaveBeenCalled());
    expect(service.indexAskMissing).toHaveBeenCalledWith({ articleIds: [1] }, false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('with another size, warns about the rest of the library and allows replacing the index', async () => {
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockResolvedValue(plan({ sizeChanged: true, othersLosingVectors: 1 }));
    await start(service);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('note')).toHaveTextContent('do outro PDF');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Recalcular e investigar' }));

    await waitFor(() => expect(service.indexAskMissing).toHaveBeenCalledWith({ articleIds: [1] }, true));
  });

  it('runs nothing and removes nothing when the person closes the question', async () => {
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockResolvedValue(plan({ sizeChanged: true, othersLosingVectors: 1 }));
    await start(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Fechar sem recalcular' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(service.indexAskMissing).not.toHaveBeenCalled();
    expect(service.massiveExtraction).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Iniciar investigação' })).toBeEnabled();
  });

  it('still runs when recalculating fails, each article saying why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockResolvedValue(plan());
    service.indexAskMissing.mockRejectedValue(new Error('provedor fora do ar'));
    await start(service);

    fireEvent.click(await screen.findByRole('button', { name: 'Recalcular e investigar' }));

    await waitFor(() => expect(service.massiveExtraction).toHaveBeenCalled());
    expect(log).toHaveBeenCalledWith(expect.stringContaining('provedor fora do ar'));
    log.mockRestore();
  });

  it('still runs when the plan cannot be made, each article saying why', async () => {
    const service = investigationService([article(1)], []);
    service.getAskIndexPlan.mockRejectedValue(new Error('sem chave'));
    await start(service);

    await waitFor(() => expect(service.massiveExtraction).toHaveBeenCalled());
  });
});

describe('InvestigationPage (#73): side panels', () => {
  it('lists the investigations in the project sidebar on a wide window, a new one first', async () => {
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    const links = within(await screen.findByRole('navigation', { name: 'Investigações do projeto' })).getAllByRole(
      'link',
    );
    expect(links.map((l) => l.textContent)).toEqual(['+ Nova investigação', expect.stringMatching(/^#14 · /)]);
    expect(screen.queryByRole('button', { name: /Investigações \(/ })).not.toBeInTheDocument();
  });

  // The sidebar folds to icons below 1200px (shell.css), with no room for the list.
  it('on a narrow window the list is a drawer on the left, closed by choosing an investigation', async () => {
    setWindowWidth(1150);
    const { service } = reviewProject();
    renderInvestigation(service, '/projects/3/investigation/14');

    expect(await screen.findByRole('heading', { name: /Investigação #14/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Investigações do projeto' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Investigações (1)' }));
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
