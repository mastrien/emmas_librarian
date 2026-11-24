import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { matchingArticles } from '../ArticlesTab';
import { webAddress } from '../LinksTab';
import { anArticle, FakeProjectReader } from './fakes/FakeProjectReader';
import { renderLibrary } from './fakes/renderLibrary';

const address = () => screen.getByTestId('address').textContent;

describe('ProjectsScreen', () => {
  it('lists the projects of the desktop, says it is live, and leads into one', async () => {
    const reader = new FakeProjectReader();
    reader.projects.push({ id: 2, name: 'Artigo de revisão', created_at: '' });
    renderLibrary(reader, '/projects');

    const project = await screen.findByText('Artigo de revisão');
    expect(screen.getByText('Biblioteca do computador, ao vivo.')).toBeInTheDocument();

    fireEvent.click(project);

    expect(address()).toBe('/projects/2');
    expect(await screen.findByText('Nenhum artigo neste projeto.')).toBeInTheDocument();
  });

  it('says a file is read-only and offers to close it', async () => {
    const leave = vi.fn();
    renderLibrary(new FakeProjectReader(false), '/projects', { leave });
    await screen.findByText('Tese');

    fireEvent.click(screen.getByRole('button', { name: 'Fechar arquivo' }));

    expect(screen.getByText('Arquivo aberto neste aparelho, somente leitura.')).toBeInTheDocument();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('says why the library did not load and tries again', async () => {
    const reader = new FakeProjectReader();
    reader.failWith = 'Token ausente, inválido ou revogado';
    renderLibrary(reader, '/projects');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar: Token ausente');

    reader.failWith = null;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Tese')).toBeInTheDocument();
  });
});

describe('matchingArticles', () => {
  const articles = [
    anArticle({ id: 1, title: 'Revisão sistemática', authors: 'Silva, A.' }),
    anArticle({ id: 2, title: 'Survey' }),
  ];

  it.each([
    ['revisao', ['Revisão sistemática']],
    ['SILVA', ['Revisão sistemática']],
    ['  ', ['Revisão sistemática', 'Survey']],
    ['nada', []],
  ])('finds %j ignoring case and accents', (text, titles) => {
    expect(matchingArticles(articles, text).map((article) => article.title)).toEqual(titles);
  });
});

describe('ProjectScreen: articles', () => {
  let reader: FakeProjectReader;

  beforeEach(() => {
    reader = new FakeProjectReader();
    reader.articles.push(
      anArticle({ id: 5, title: 'Revisão sistemática', authors: 'Silva, A.', year: 2021, local_file_path: '/a.pdf' }),
      anArticle({ id: 6, title: 'Survey', status: 'archived' }),
    );
  });

  it('names the project, lists its articles with status and PDF mark, and opens one', async () => {
    renderLibrary(reader, '/projects/1');
    const row = (await screen.findByText('Revisão sistemática')).closest('a')!;

    expect(screen.getByRole('heading', { level: 1, name: 'Tese' })).toBeInTheDocument();
    expect(within(row).getByText('PDF')).toBeInTheDocument();
    expect(within(row).getByText(/Silva, A\. · 2021/)).toBeInTheDocument();
    expect(screen.getByText('Arquivado')).toBeInTheDocument();

    fireEvent.click(row);
    expect(address()).toBe('/articles/5');
    expect(await screen.findByText('Nada marcado neste artigo.')).toBeInTheDocument();
  });

  it('filters by title or author and says when nothing matches', async () => {
    renderLibrary(reader, '/projects/1');
    await screen.findByText('Survey');

    fireEvent.change(screen.getByLabelText('Filtrar artigos'), { target: { value: 'silva' } });
    expect(screen.queryByText('Survey')).not.toBeInTheDocument();
    expect(screen.getByText('Revisão sistemática')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filtrar artigos'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum artigo com esse texto.')).toBeInTheDocument();
  });

  it('says a project has no articles, and moves between the tabs by the address', async () => {
    reader.articles = [];
    renderLibrary(reader, '/projects/1/articles');
    expect(await screen.findByText('Nenhum artigo neste projeto.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Diário' }));

    expect(address()).toBe('/projects/1/diary');
    expect(screen.getByRole('link', { name: 'Diário' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByLabelText('Página de hoje')).toBeInTheDocument();
  });
});

describe('ProjectScreen: diary, one page at a time', () => {
  let reader: FakeProjectReader;
  const TODAY = '2026-11-14';

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 14, 10, 0));
    reader = new FakeProjectReader();
    reader.diary.push(
      { id: 1, project_id: 1, entry_date: '2026-11-10', content: 'Li o primeiro.' },
      { id: 2, project_id: 1, entry_date: '2026-11-12', content: 'Li o segundo.' },
    );
    return () => vi.useRealTimers();
  });

  it('opens on today, with the page before one tap away', async () => {
    renderLibrary(reader, '/projects/1/diary');
    expect(await screen.findByLabelText('Página de hoje')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));

    expect(await screen.findByLabelText(/Página de 12 de novembro/)).toHaveValue('Li o segundo.');
    expect(screen.queryByText('Li o primeiro.')).not.toBeInTheDocument();
  });

  it('goes back through the pages and forward again', async () => {
    renderLibrary(reader, '/projects/1/diary');
    await screen.findByLabelText('Página de hoje');
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(await screen.findByLabelText(/Página de 10 de novembro/)).toHaveValue('Li o primeiro.');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(await screen.findByLabelText(/Página de 12 de novembro/)).toBeInTheDocument();
  });

  it('opens a calendar from the date, marks the days with a page, and jumps to one', async () => {
    renderLibrary(reader, '/projects/1/diary');
    await screen.findByLabelText('Página de hoje');

    fireEvent.click(screen.getByRole('button', { name: 'Escolher outra página' }));
    const calendar = screen.getByRole('dialog', { name: 'Escolher página do diário' });
    expect(within(calendar).getByText('novembro de 2026')).toBeInTheDocument();
    expect(within(calendar).getByRole('button', { name: 'Dia 10' })).toHaveClass('has-page');
    expect(within(calendar).getByRole('button', { name: 'Dia 11' })).not.toHaveClass('has-page');

    fireEvent.click(within(calendar).getByRole('button', { name: 'Dia 10' }));

    expect(await screen.findByLabelText(/Página de 10 de novembro/)).toHaveValue('Li o primeiro.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('writes on a day without a page, and comes back to today in one tap', async () => {
    renderLibrary(reader, '/projects/1/diary');
    await screen.findByLabelText('Página de hoje');
    fireEvent.click(screen.getByRole('button', { name: 'Escolher outra página' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dia 11' }));
    expect(await screen.findByLabelText(/Página de 11 de novembro/)).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Escolher outra página' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir para hoje' }));

    expect(await screen.findByLabelText('Página de hoje')).toBeInTheDocument();
  });

  it("saves today's page and keeps the confirmation on screen", async () => {
    renderLibrary(reader, '/projects/1/diary');
    const editor = await screen.findByLabelText('Página de hoje');
    expect(screen.getByRole('button', { name: 'Salvar página' })).toBeDisabled();

    fireEvent.change(editor, { target: { value: 'Do celular.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar página' }));

    await waitFor(() => expect(reader.written).toEqual([`saveDiaryEntry(1, ${TODAY}, Do celular.)`]));
    expect(await screen.findByLabelText('Página de hoje')).toHaveValue('Do celular.');
    expect(screen.getByText('Salvo no computador.')).toBeInTheDocument();
  });

  it("continues today's page when it already has text", async () => {
    reader.diary.push({ id: 3, project_id: 1, entry_date: TODAY, content: 'De manhã.' });
    renderLibrary(reader, '/projects/1/diary');
    expect(await screen.findByLabelText('Página de hoje')).toHaveValue('De manhã.');
  });

  it('says when the page could not be saved, and keeps the text', async () => {
    reader.failWrites = true;
    renderLibrary(reader, '/projects/1/diary');
    fireEvent.change(await screen.findByLabelText('Página de hoje'), { target: { value: 'Rascunho' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar página' }));

    expect(await screen.findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Página de hoje')).toHaveValue('Rascunho');
  });

  it('draws the Markdown of a page formatted in a file (#191), and offers nothing to write', async () => {
    const file = new FakeProjectReader(false);
    file.diary.push({ id: 9, project_id: 1, entry_date: '2026-11-13', content: 'Achei **importante**.' });
    renderLibrary(file, '/projects/1/diary');

    expect((await screen.findByText('importante')).tagName).toBe('STRONG');
    expect(screen.queryByLabelText('Página de hoje')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar página' })).not.toBeInTheDocument();
  });

  it('says when the diary of a file is empty', async () => {
    renderLibrary(new FakeProjectReader(false), '/projects/1/diary');
    expect(await screen.findByText('Nenhuma página no diário.')).toBeInTheDocument();
  });
});

describe('webAddress', () => {
  it.each([
    ['https://example.org/a', 'https://example.org/a'],
    [' example.org/edital ', 'https://example.org/edital'],
    ['http://x.org', 'http://x.org/'],
  ])('reads %j as %s', (text, address) => {
    expect(webAddress(text)).toBe(address);
  });

  it.each(['', '   ', 'javascript:alert(1)', 'file:///etc/passwd', 'ht tp://x'])('refuses %j', (text) => {
    expect(webAddress(text)).toBeNull();
  });
});

describe('ProjectScreen: quick access', () => {
  let reader: FakeProjectReader;

  beforeEach(() => {
    reader = new FakeProjectReader();
    reader.documents.push(
      {
        id: 7,
        project_id: 1,
        title: 'Edital',
        url: 'https://example.org/edital',
        category: 'Chamadas',
        created_at: '',
      },
      { id: 8, project_id: 1, title: 'Normas', local_file_path: 'C:/docs/normas.pdf', created_at: '' },
    );
  });

  it('opens a link in the browser and tells the desktop it was opened', async () => {
    renderLibrary(reader, '/projects/1/links');
    const link = (await screen.findByText('Edital')).closest('a')!;

    // jsdom does not navigate; the click handler is what is under test.
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);

    expect(link).toHaveAttribute('href', 'https://example.org/edital');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(link).getByText('Chamadas · example.org')).toBeInTheDocument();
    expect(reader.written).toEqual(['markDocumentOpened(7)']);
  });

  it('shows a document that is a file of the desktop without a link', async () => {
    renderLibrary(reader, '/projects/1/links');

    const row = (await screen.findByText('Normas')).closest('li')!;
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    expect(within(row).getByText('arquivo no computador')).toBeInTheDocument();
  });

  it('adds a link, completing the address, and lists it', async () => {
    renderLibrary(reader, '/projects/1/links');
    fireEvent.change(await screen.findByLabelText('Título do link'), { target: { value: ' Periódico ' } });
    fireEvent.change(screen.getByLabelText('Endereço do link'), { target: { value: 'example.org/revista' } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Periódico')).toBeInTheDocument();
    expect(reader.written).toEqual(['addQuickLink(1, Periódico, https://example.org/revista)']);
    expect(screen.getByLabelText('Título do link')).toHaveValue('');
  });

  it.each([
    ['no title', '', 'https://example.org'],
    ['an address that is not of the web', 'X', 'javascript:alert(1)'],
  ])('refuses a link with %s and adds nothing', async (_label, title, url) => {
    renderLibrary(reader, '/projects/1/links');
    fireEvent.change(await screen.findByLabelText('Título do link'), { target: { value: title } });
    fireEvent.change(screen.getByLabelText('Endereço do link'), { target: { value: url } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Dê um título e um endereço da web');
    expect(reader.written).toEqual([]);
  });

  it('offers no form in a file and says when there are no documents', async () => {
    renderLibrary(new FakeProjectReader(false), '/projects/1/links');

    expect(await screen.findByText('Nenhum documento de acesso rápido.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título do link')).not.toBeInTheDocument();
  });
});
