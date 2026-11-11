import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type {
  AskClaim,
  AskConversation,
  AskReadCitation,
  Project,
  ProjectIndexArticle,
  ProjectIndexCoverage,
} from '../../../types';
import { AskPage } from '../AskPage';

const article = (id: number): ProjectIndexArticle => ({
  id,
  title: `Artigo ${id}`,
  authors: null,
  year: null,
  pdfPath: 'a.pdf',
});

const coverage = (extra: Partial<ProjectIndexCoverage> = {}): ProjectIndexCoverage => ({
  total: 1,
  indexed: [article(1)],
  withoutIndex: [],
  withoutPdf: [],
  outdated: [],
  previousModel: null,
  ...extra,
});

const citation = (extra: Partial<AskReadCitation> = {}): AskReadCitation => ({
  articleId: 1,
  title: 'Séries históricas',
  authors: 'Almeida, R.',
  year: 2021,
  page: 4,
  bbox: { x: 0, y: 0, w: 1, h: 1 },
  text: 'sessenta anos de dados',
  pdfPath: 'a.pdf',
  access: { kind: 'open', articleId: 1 },
  ...extra,
});

const conversation = (claims: AskClaim<AskReadCitation>[], id = 5): AskConversation => ({
  id,
  title: 'Qual a amostra?',
  projects: [{ id: 3, name: 'Revisão' }],
  messages: [
    { id: 1, role: 'user', content: 'Qual a amostra?', answer: null, created_at: '' },
    {
      id: 2,
      role: 'assistant',
      content: '',
      created_at: '',
      answer: { claims, steps: [{ kind: 'search', chunks: 20, articles: 12, projects: ['Revisão'] }] },
    },
  ],
});

const checked: AskClaim<AskReadCitation> = { text: 'A série tem 60 anos.', citations: [citation()], unverified: null };
const invented: AskClaim<AskReadCitation> = {
  text: 'O milho caiu 12%.',
  citations: [],
  unverified: { kind: 'no_source' },
};

const Where = () => <span data-testid="where">{useLocation().pathname + JSON.stringify(useLocation().state)}</span>;

function serviceWith(extra: Partial<ProjectIndexCoverage> = {}): FakeProjectService {
  const service = new FakeProjectService();
  service.getProjects.mockResolvedValue([
    { id: 3, name: 'Revisão' },
    { id: 4, name: 'Outro' },
  ] as Project[]);
  service.getAskCoverage.mockResolvedValue(coverage(extra));
  return service;
}

// The page loads on its own after most actions (coverage, list, conversation): this lets all of it finish, so what a
// test asserts next is the settled page.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });

async function press(element: Element) {
  fireEvent.click(element);
  await settle();
}

async function open(service: FakeProjectService, path = '/ask') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider apiService={service}>
        <Routes>
          <Route path="/ask" element={<AskPage />} />
          <Route path="/ask/:conversationId" element={<AskPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
        <Where />
      </ServicesProvider>
    </MemoryRouter>,
  );
  await settle();
}

const box = () => screen.getByRole('textbox', { name: 'Sua pergunta' });

async function chooseProject(...names: string[]) {
  await press(screen.getByRole('button', { name: '+ projeto' }));
  for (const name of names) await press(await screen.findByRole('checkbox', { name }));
}

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

describe('AskPage (#53)', () => {
  // Wide unless a test says otherwise: below 1100px the side panels are drawers.
  beforeEach(() => setWindowWidth(1400));
  afterEach(() => setWindowWidth(1024));

  describe('on a narrow window', () => {
    beforeEach(() => setWindowWidth(900));

    it('keeps the conversations in a drawer', async () => {
      const service = serviceWith();
      service.getAskConversations.mockResolvedValue([{ id: 6, title: 'Outra', updated_at: '', project_count: 1 }]);
      await open(service);
      await waitFor(() => expect(service.getAskConversations).toHaveBeenCalled());
      expect(screen.queryByRole('navigation', { name: 'Conversas' })).not.toBeInTheDocument();

      await press(screen.getByRole('button', { name: 'Conversas' }));
      const drawer = await screen.findByRole('dialog', { name: 'Conversas' });

      await press(await within(drawer).findByRole('link', { name: /Outra/ }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conversas' })).not.toBeInTheDocument());
    });

    it('shows the chunk in a drawer', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([checked]));
      await open(service, '/ask/5');

      await press(await screen.findByRole('button', { name: 'Almeida 2021, p. 4' }));

      const drawer = await screen.findByRole('dialog', { name: 'Trecho citado' });
      expect(within(drawer).getByText('sessenta anos de dados')).toBeInTheDocument();
    });
  });

  it('starts asking for a project, and cannot send without one', async () => {
    await open(serviceWith());

    expect(await screen.findByRole('heading', { name: 'O que você quer saber?' })).toBeInTheDocument();
    expect(box()).toHaveAttribute('placeholder', 'Escolha ao menos um projeto para perguntar');
    fireEvent.change(box(), { target: { value: 'Qual a amostra?' } });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('asks over the projects chosen and opens the new conversation', async () => {
    const service = serviceWith();
    service.sendAskQuestion.mockResolvedValue(conversation([checked]));
    service.getAskConversation.mockResolvedValue(conversation([checked]));
    await open(service);
    await chooseProject('Revisão', 'Outro');
    await waitFor(() => expect(service.getAskCoverage).toHaveBeenCalledWith([3, 4]));

    fireEvent.change(box(), { target: { value: 'Qual a amostra?' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled());
    await press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('A série tem 60 anos.')).toBeInTheDocument();
    expect(service.sendAskQuestion).toHaveBeenCalledWith({
      conversationId: null,
      projectIds: [3, 4],
      question: 'Qual a amostra?',
    });
    expect(screen.getByText('Buscou nos PDFs de 1 projeto: 20 trechos de 12 artigos')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('where')[0]).toHaveTextContent('/ask/5'));
    expect(box()).toHaveValue('');
  });

  it('sends with Enter and breaks the line with Shift+Enter', async () => {
    const service = serviceWith();
    service.getAskConversation.mockResolvedValue(conversation([checked]));
    service.sendAskQuestion.mockResolvedValue(conversation([checked]));
    await open(service, '/ask/5');
    await screen.findByText('A série tem 60 anos.');
    await waitFor(() => expect(box()).toHaveAttribute('placeholder', 'Pergunte aos artigos destes projetos…'));
    fireEvent.change(box(), { target: { value: 'e no Almeida?' } });

    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true });
    expect(service.sendAskQuestion).not.toHaveBeenCalled();

    fireEvent.keyDown(box(), { key: 'Enter' });
    await settle();
    await waitFor(() =>
      expect(service.sendAskQuestion).toHaveBeenCalledWith({
        conversationId: 5,
        projectIds: [3],
        question: 'e no Almeida?',
      }),
    );
  });

  it('shows the question while it is answered', async () => {
    const service = serviceWith();
    service.getAskConversation.mockResolvedValue(conversation([checked]));
    let finish: (value: AskConversation) => void = () => undefined;
    service.sendAskQuestion.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await open(service, '/ask/5');
    await screen.findByText('A série tem 60 anos.');
    await waitFor(() => expect(box()).toHaveAttribute('placeholder', 'Pergunte aos artigos destes projetos…'));

    fireEvent.change(box(), { target: { value: 'e agora?' } });
    await press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('e agora?')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Lendo os PDFs');
    expect(screen.getByRole('button', { name: 'Perguntando…' })).toBeDisabled();
    finish(conversation([checked]));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('gives the text back and says why when the question fails', async () => {
    const service = serviceWith();
    service.getAskConversation.mockResolvedValue(conversation([checked]));
    service.sendAskQuestion.mockRejectedValue(new Error('cota esgotada'));
    await open(service, '/ask/5');
    await screen.findByText('A série tem 60 anos.');
    await waitFor(() => expect(box()).toHaveAttribute('placeholder', 'Pergunte aos artigos destes projetos…'));

    fireEvent.change(box(), { target: { value: 'e agora?' } });
    await press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cota esgotada');
    expect(box()).toHaveValue('e agora?');
  });

  describe('statements that could not be checked', () => {
    it('keeps them, marked, with the reason and a notice to audit', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([checked, invented]));
      await open(service, '/ask/5');

      const point = (await screen.findByText(/O milho caiu 12%/)).closest('li') as HTMLElement;

      expect(point).toHaveClass('ask-claim--unverified');
      expect(point).toHaveTextContent('A IA não indicou de onde tirou isto. Confira antes de usar.');
      expect(screen.getByRole('note')).toHaveTextContent('1 ponto desta resposta não pôde ser conferido.');
      expect(screen.getByRole('note')).toHaveTextContent('A IA pode ter inventado');
    });

    it('has no notice when everything checks out, only the reminder', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([checked]));
      await open(service, '/ask/5');

      await screen.findByText('A série tem 60 anos.');

      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      expect(screen.getByText(/abra as citações para conferir/)).toBeInTheDocument();
    });
  });

  it('says when what was read does not answer', async () => {
    const service = serviceWith();
    service.getAskConversation.mockResolvedValue(conversation([]));
    await open(service, '/ask/5');

    expect(await screen.findByText(/não respondem a esta pergunta/)).toBeInTheDocument();
  });

  // Board 168: numbered chips and the list of sources beside the picked one.
  describe('numbered sources', () => {
    const second = citation({
      articleId: 2,
      page: 9,
      title: 'Outro estudo',
      text: 'segundo trecho',
      access: { kind: 'open', articleId: 2 },
    });
    const withTwo = {
      text: 'Duas fontes.',
      citations: [citation(), second],
      unverified: null,
    } as AskClaim<AskReadCitation>;

    it('numbers the chips, lists every source in the panel and switches the picked one', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([withTwo]));
      await open(service, '/ask/5');

      await press(await screen.findByRole('button', { name: 'Almeida 2021, p. 4' }));
      const list = screen.getByRole('list', { name: 'Fontes' });
      expect(within(list).getAllByRole('button')).toHaveLength(2);
      await press(within(list).getByRole('button', { name: 'Ver a fonte 2: Outro estudo' }));

      expect(screen.getByText('segundo trecho')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver a fonte 2: Outro estudo' })).toHaveClass('is-on');
    });

    it('says how many sources the answer has and offers to copy it', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([withTwo]));
      await open(service, '/ask/5');

      expect(await screen.findByText(/2 fontes\./)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    });
  });

  it('starts a new conversation with Ctrl N, from anywhere on the page', async () => {
    const service = serviceWith();
    service.getAskConversation.mockResolvedValue(conversation([checked]));
    await open(service, '/ask/5');
    await screen.findByRole('log', { name: 'Conversa' });

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

    await waitFor(() => expect(screen.getAllByTestId('where')[0].textContent).toMatch(/^\/ask(null)?$/));
  });

  describe('citations', () => {
    async function openCitation(access: AskReadCitation['access']) {
      const service = serviceWith();
      const claim = { ...checked, citations: [citation({ access })] };
      service.getAskConversation.mockResolvedValue(conversation([claim]));
      await open(service, '/ask/5');
      await press(await screen.findByRole('button', { name: 'Almeida 2021, p. 4' }));
    }

    it('shows the chunk and opens the reader on its page, coming back to the conversation', async () => {
      await openCitation({ kind: 'open', articleId: 1 });

      expect(screen.getByText('sessenta anos de dados')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Almeida 2021, p. 4' })).toHaveAttribute('aria-pressed', 'true');
      await press(screen.getByRole('button', { name: 'Abrir no leitor, página 4' }));

      const where = await screen.findAllByTestId('where');
      expect(where[0]).toHaveTextContent('/articles/1');
      expect(where[0]).toHaveTextContent('"page":4');
      expect(where[0]).toHaveTextContent('"path":"/ask/5"');
    });

    it('closes with the X', async () => {
      await openCitation({ kind: 'open', articleId: 1 });

      await press(screen.getByRole('button', { name: 'Fechar o trecho' }));

      expect(screen.queryByText('sessenta anos de dados')).not.toBeInTheDocument();
    });

    it('opens through the copy in another project, and says so', async () => {
      await openCitation({ kind: 'open', articleId: 9 });

      expect(screen.getByRole('note')).toHaveTextContent('cópia em outro projeto');
      await press(screen.getByRole('button', { name: 'Abrir no leitor, página 4' }));

      expect((await screen.findAllByTestId('where'))[0]).toHaveTextContent('/articles/9');
    });

    it.each([
      ['trash', 'lixeira'],
      ['gone', 'não estão mais na biblioteca'],
    ] as const)('keeps the chunk readable without opening when %s', async (kind, note) => {
      await openCitation({ kind });

      expect(screen.getByRole('note')).toHaveTextContent(note);
      expect(screen.getByText('sessenta anos de dados')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Abrir no leitor/ })).not.toBeInTheDocument();
    });
  });

  describe('PDFs without an index', () => {
    const missing = () => serviceWith({ withoutIndex: [article(2), article(3)] });

    it('offers to index them, and the notice goes when it is done', async () => {
      const service = missing();
      service.indexAskMissing.mockResolvedValue({ coverage: coverage(), failed: [] });
      await open(service);
      await chooseProject('Revisão');

      expect(await screen.findByText('2 PDFs destes projetos ainda não entram nas respostas.')).toBeInTheDocument();
      await press(screen.getByRole('button', { name: 'Indexar agora' }));

      await waitFor(() => expect(service.indexAskMissing).toHaveBeenCalledWith({ projectIds: [3] }, false));
      await waitFor(() => expect(screen.queryByText(/ainda não entram nas respostas/)).not.toBeInTheDocument());
    });

    it('says it is indexing', async () => {
      const service = missing();
      service.indexAskMissing.mockImplementation(() => new Promise(() => undefined));
      await open(service);
      await chooseProject('Revisão');

      await press(await screen.findByRole('button', { name: 'Indexar agora' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Indexando 2 PDFs');
    });

    it('says which PDF it is on, of how many', async () => {
      const service = missing();
      service.indexAskMissing.mockImplementation(() => new Promise(() => undefined));
      service.getAskIndexProgress.mockResolvedValue({ done: 2, total: 12, current: 'Silva 2020' });
      await open(service);
      await chooseProject('Revisão');

      await press(await screen.findByRole('button', { name: 'Indexar agora' }));

      expect(await screen.findByText('Indexando 3 de 12 PDFs: Silva 2020…')).toBeInTheDocument();
    });

    it('names what could not be indexed, and the notice stays', async () => {
      const service = missing();
      service.indexAskMissing.mockResolvedValue({
        coverage: coverage({ withoutIndex: [article(2)] }),
        failed: [{ title: 'Artigo 2', reason: 'Arquivo não encontrado' }],
      });
      await open(service);
      await chooseProject('Revisão');

      await press(await screen.findByRole('button', { name: 'Indexar agora' }));

      expect(await screen.findByText('1 PDF não puderam ser indexados')).toBeInTheDocument();
      expect(screen.getByText('Artigo 2: Arquivo não encontrado')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Indexar agora' })).toBeInTheDocument();
    });

    it('shows why indexing was refused', async () => {
      const service = missing();
      service.indexAskMissing.mockRejectedValue(new Error('vetores de 2 dimensões'));
      await open(service);
      await chooseProject('Revisão');

      await press(await screen.findByRole('button', { name: 'Indexar agora' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('vetores de 2 dimensões');
    });

    it('cannot ask before anything is indexed', async () => {
      const service = serviceWith({ indexed: [], withoutIndex: [article(2)] });
      await open(service);
      await chooseProject('Revisão');

      await waitFor(() =>
        expect(box()).toHaveAttribute('placeholder', 'Nenhum PDF destes projetos está indexado com o modelo atual'),
      );
    });

    describe('after the embedding model changes', () => {
      const plan = (extra = {}) => ({
        pending: 1,
        outdated: 1,
        sizeChanged: false,
        othersLosingVectors: 0,
        previousModel: null,
        ...extra,
      });

      it('says what must be recalculated and that it costs tokens, and recalculates at the click', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        service.getAskIndexPlan.mockResolvedValue(plan());
        service.indexAskMissing.mockResolvedValue({ coverage: coverage(), failed: [] });
        await open(service);
        await chooseProject('Revisão');

        expect(await screen.findByText(/1 PDF precisa ser recalculado.*consome tokens/)).toBeInTheDocument();
        await press(screen.getByRole('button', { name: 'Recalcular 1 PDF' }));

        await waitFor(() => expect(service.indexAskMissing).toHaveBeenCalledWith({ projectIds: [3] }, false));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText(/precisa ser recalculado/)).not.toBeInTheDocument());
      });

      it('says going back to the previous model spares recalculating, with the way to the settings', async () => {
        const service = serviceWith({ outdated: [article(1)], previousModel: 'ollama/nomic-embed-text' });
        await open(service);
        await chooseProject('Revisão');

        expect(await screen.findByText(/Eles vieram de nomic-embed-text \(Ollama\)/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/settings');
      });

      it('says nothing of a previous model it does not know', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        await open(service);
        await chooseProject('Revisão');

        await screen.findByRole('button', { name: 'Recalcular 1 PDF' });
        expect(screen.queryByText(/Prefere não recalcular/)).not.toBeInTheDocument();
      });

      it('says it again before removing the vectors of the others', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        service.getAskIndexPlan.mockResolvedValue(
          plan({ sizeChanged: true, othersLosingVectors: 2, previousModel: 'local/all-MiniLM-L6-v2' }),
        );
        await open(service);
        await chooseProject('Revisão');

        await press(await screen.findByRole('button', { name: 'Recalcular 1 PDF' }));

        expect(within(screen.getByRole('dialog')).getByTestId('previous-model')).toHaveTextContent(
          'all-MiniLM-L6-v2 (Local Embutido)',
        );
      });

      it('counts both kinds on one button', async () => {
        const service = serviceWith({ outdated: [article(1)], withoutIndex: [article(2), article(3)] });
        await open(service);
        await chooseProject('Revisão');

        expect(await screen.findByRole('button', { name: 'Recalcular 3 PDFs' })).toBeInTheDocument();
      });

      it('cannot ask when all that is indexed came from another model', async () => {
        const service = serviceWith({ indexed: [], outdated: [article(1)] });
        await open(service);
        await chooseProject('Revisão');

        await waitFor(() =>
          expect(box()).toHaveAttribute('placeholder', 'Nenhum PDF destes projetos está indexado com o modelo atual'),
        );
      });

      it('with another size, says how many others lose their vectors before removing anything', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        service.getAskIndexPlan.mockResolvedValue(plan({ sizeChanged: true, othersLosingVectors: 190 }));
        service.indexAskMissing.mockResolvedValue({ coverage: coverage(), failed: [] });
        await open(service);
        await chooseProject('Revisão');

        await press(await screen.findByRole('button', { name: 'Recalcular 1 PDF' }));

        expect(within(screen.getByRole('dialog')).getByRole('note')).toHaveTextContent('dos outros 190 PDFs');
        expect(service.indexAskMissing).not.toHaveBeenCalled();
        await press(within(screen.getByRole('dialog')).getByRole('button', { name: 'Recalcular' }));

        await waitFor(() => expect(service.indexAskMissing).toHaveBeenCalledWith({ projectIds: [3] }, true));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it('removes nothing when the person closes the question', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        service.getAskIndexPlan.mockResolvedValue(plan({ sizeChanged: true, othersLosingVectors: 1 }));
        await open(service);
        await chooseProject('Revisão');
        await press(await screen.findByRole('button', { name: 'Recalcular 1 PDF' }));

        await press(screen.getByRole('button', { name: 'Fechar sem recalcular' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(service.indexAskMissing).not.toHaveBeenCalled();
      });

      it('takes the size change along when no other PDF is at stake', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        service.getAskIndexPlan.mockResolvedValue(plan({ sizeChanged: true }));
        service.indexAskMissing.mockResolvedValue({ coverage: coverage(), failed: [] });
        await open(service);
        await chooseProject('Revisão');

        await press(await screen.findByRole('button', { name: 'Recalcular 1 PDF' }));

        await waitFor(() => expect(service.indexAskMissing).toHaveBeenCalledWith({ projectIds: [3] }, true));
      });

      it('shows why the plan could not be made', async () => {
        const service = serviceWith({ outdated: [article(1)] });
        service.getAskIndexPlan.mockRejectedValue(new Error('provedor fora do ar'));
        await open(service);
        await chooseProject('Revisão');

        await press(await screen.findByRole('button', { name: 'Recalcular 1 PDF' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('provedor fora do ar');
        expect(service.indexAskMissing).not.toHaveBeenCalled();
      });
    });
  });

  describe('the projects of a conversation', () => {
    it('loads those of the conversation', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([checked]));
      await open(service, '/ask/5');

      expect(await screen.findByRole('button', { name: 'Tirar Revisão' })).toBeInTheDocument();
      await waitFor(() => expect(service.getAskCoverage).toHaveBeenCalledWith([3]));
    });

    it('takes one out with its X', async () => {
      const service = serviceWith();
      service.getAskConversation.mockResolvedValue(conversation([checked]));
      await open(service, '/ask/5');

      await press(await screen.findByRole('button', { name: 'Tirar Revisão' }));

      expect(screen.queryByRole('button', { name: 'Tirar Revisão' })).not.toBeInTheDocument();
      expect(box()).toHaveAttribute('placeholder', 'Escolha ao menos um projeto para perguntar');
    });

    it('closes the menu on a click elsewhere', async () => {
      await open(serviceWith());
      await press(screen.getByRole('button', { name: '+ projeto' }));
      expect(await screen.findByRole('group', { name: 'Projetos que respondem' })).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      await settle();

      expect(screen.queryByRole('group', { name: 'Projetos que respondem' })).not.toBeInTheDocument();
    });
  });

  describe('the kept conversations', () => {
    const summaries = [
      { id: 5, title: 'Qual a amostra?', updated_at: '', project_count: 2 },
      { id: 6, title: 'Outra pergunta', updated_at: '', project_count: 1 },
    ];

    it('lists them', async () => {
      const service = serviceWith();
      service.getAskConversations.mockResolvedValue(summaries);
      await open(service);

      const list = await screen.findByRole('navigation', { name: 'Conversas' });

      expect(await within(list).findByRole('link', { name: /Qual a amostra\?.*2 projetos/ })).toBeInTheDocument();
      expect(within(list).getByRole('link', { name: /Outra pergunta.*1 projeto/ })).toBeInTheDocument();
    });

    it('asks before deleting, and goes to a new one when it was open', async () => {
      const service = serviceWith();
      service.getAskConversations.mockResolvedValue(summaries);
      service.getAskConversation.mockResolvedValue(conversation([checked]));
      await open(service, '/ask/5');

      await press(await screen.findByRole('button', { name: 'Apagar a conversa: Qual a amostra?' }));
      expect(service.deleteAskConversation).not.toHaveBeenCalled();
      await press(screen.getByRole('button', { name: 'Apagar' }));

      await waitFor(() => expect(service.deleteAskConversation).toHaveBeenCalledWith(5));
      await waitFor(() => expect(screen.getAllByTestId('where')[0].textContent).toMatch(/^\/ask(null)?$/));
    });

    it('can give up deleting', async () => {
      const service = serviceWith();
      service.getAskConversations.mockResolvedValue(summaries);
      await open(service);

      await press(await screen.findByRole('button', { name: 'Apagar a conversa: Outra pergunta' }));
      await press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(service.deleteAskConversation).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: /Outra pergunta/ })).toBeInTheDocument();
    });

    it('shows why a conversation did not open', async () => {
      const service = serviceWith();
      service.getAskConversation.mockRejectedValue(new Error('conversationId=5'));
      await open(service, '/ask/5');

      expect(await screen.findByRole('alert')).toHaveTextContent('conversationId=5');
    });
  });
});
