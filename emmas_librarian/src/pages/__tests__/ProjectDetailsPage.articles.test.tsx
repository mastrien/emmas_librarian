import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { givenProject, renderProjectPage, article, mainTable } from './support/projectPageHarness';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

const rowTitles = () =>
  within(mainTable())
    .getAllByRole('row')
    .map((row) => row.textContent ?? '')
    .filter((text) => text.includes('Artigo') || text.includes('Paper'));

const inRow = (title: string) => within(within(mainTable()).getByText(title).closest('tr') as HTMLElement);
// Unlink, edit and cite live in each row's "⋯" menu, which opens in a portal.
const chooseFromRowMenu = (title: string, item: string) => {
  fireEvent.click(inRow(title).getByRole('button', { name: 'Mais ações' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
};

describe('ProjectDetailsPage filters', () => {
  const articles = [
    article({ id: 1, title: 'Paper about genes', authors: 'Ana', local_file_path: '/a.pdf', is_oa: 1, year: 2019 }),
    article({ id: 2, title: 'Paper about proteins', authors: 'Bruno', year: 2023 }),
  ];

  it('filters by title or author as the user types', async () => {
    await renderProjectPage(givenProject(articles));

    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou autor'), { target: { value: 'bruno' } });

    expect(within(mainTable()).queryByText('Paper about genes')).not.toBeInTheDocument();
    expect(within(mainTable()).getByText('Paper about proteins')).toBeInTheDocument();
  });

  it.each([['Com PDF'], ['Acesso aberto']])(
    'narrows the list with "%s" and shows it as a removable chip',
    async (label) => {
      await renderProjectPage(givenProject(articles));

      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^${label},`) }));

      expect(within(mainTable()).getByText('Paper about genes')).toBeInTheDocument();
      expect(within(mainTable()).queryByText('Paper about proteins')).not.toBeInTheDocument();
      expect(screen.getByText('1 de 2 artigos')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: `Remover filtro ${label}` }));
      expect(within(mainTable()).getByText('Paper about proteins')).toBeInTheDocument();
    },
  );

  it('reorders the list', async () => {
    await renderProjectPage(givenProject(articles));

    fireEvent.change(screen.getByRole('combobox', { name: /Ordenar/ }), { target: { value: 'year-asc' } });
    expect(rowTitles()[0]).toContain('Paper about genes');

    fireEvent.change(screen.getByDisplayValue('Mais antigos'), { target: { value: 'year-desc' } });
    expect(rowTitles()[0]).toContain('Paper about proteins');
  });

  it('applies the sidebar status, database and keyword filters', async () => {
    await renderProjectPage(
      givenProject([
        article({ id: 1, title: 'Paper One', source_databases: '["OpenAlex"]', author_keywords: 'React; Testing' }),
        article({
          id: 2,
          title: 'Paper Two',
          source_databases: '["Scopus"]',
          status: 'read',
          author_keywords: 'Database; SQL',
        }),
      ]),
    );
    const listed = (title: string) => within(mainTable()).queryByText(title);
    expect(listed('Paper One')).toBeInTheDocument();
    expect(listed('Paper Two')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Lidos,/ }));
    expect(listed('Paper One')).not.toBeInTheDocument();
    expect(listed('Paper Two')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Todos,/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^OpenAlex,/ }));
    expect(listed('Paper One')).toBeInTheDocument();
    expect(listed('Paper Two')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /^OpenAlex,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^SQL,/ }));
    expect(listed('Paper One')).not.toBeInTheDocument();
    expect(listed('Paper Two')).toBeInTheDocument();
  });

  it('hides and shows the filter sidebar', async () => {
    await renderProjectPage(givenProject(articles));
    expect(screen.getByRole('complementary', { name: 'Filtros' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    expect(screen.queryByRole('complementary', { name: 'Filtros' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    expect(screen.getByRole('complementary', { name: 'Filtros' })).toBeInTheDocument();
  });
});

describe('ProjectDetailsPage read and archived sections', () => {
  const articles = [
    article({ id: 1, title: 'Artigo novo' }),
    article({ id: 2, title: 'Artigo lido', status: 'read' }),
    article({ id: 3, title: 'Artigo arquivado', status: 'archived', archive_note: 'fora do escopo' }),
  ];

  it('groups read and archived articles with counts and the archive reason', async () => {
    await renderProjectPage(givenProject(articles));

    expect(screen.getByText('Artigos Lidos (1)')).toBeInTheDocument();
    expect(screen.getByText('Artigos Arquivados (1)')).toBeInTheDocument();
    expect(screen.getByText('Motivo: fora do escopo')).toBeInTheDocument();
  });

  it('moves a read article back to new', async () => {
    const service = givenProject(articles);
    await renderProjectPage(service);
    const readSection = screen.getByText('Artigos Lidos (1)').closest('details') as HTMLElement;

    fireEvent.click(within(readSection).getByRole('button', { name: 'Desmarcar' }));

    await waitFor(() => expect(screen.queryByText('Artigos Lidos (1)')).not.toBeInTheDocument());
    expect(service.updateArticleStatus).toHaveBeenCalledWith(2, 'new', undefined);
  });

  it('restores an archived article', async () => {
    const service = givenProject(articles);
    await renderProjectPage(service);
    const archived = screen.getByText('Artigos Arquivados (1)').closest('details') as HTMLElement;

    fireEvent.click(within(archived).getByRole('button', { name: 'Restaurar' }));

    await waitFor(() => expect(screen.queryByText('Artigos Arquivados (1)')).not.toBeInTheDocument());
    expect(service.updateArticleStatus).toHaveBeenCalledWith(3, 'new', undefined);
  });

  it('opens citation, details and mass citation from the read section', async () => {
    await renderProjectPage(givenProject(articles));
    const readSection = () => screen.getByText('Artigos Lidos (1)').closest('details') as HTMLElement;

    fireEvent.click(within(readSection()).getByRole('button', { name: 'Citar' }));
    expect(await screen.findByText('Gerar Citação')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Gerar Citação').nextElementSibling as HTMLElement);

    fireEvent.click(within(readSection()).getByRole('button', { name: /Citação em Massa/ }));
    expect(await screen.findByText(/Citação em Massa/, { selector: 'h2, h3' })).toBeInTheDocument();
  });

  it('links read articles to the reader', async () => {
    await renderProjectPage(givenProject(articles));
    const readSection = screen.getByText('Artigos Lidos (1)').closest('details') as HTMLElement;

    expect(within(readSection).getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/articles/2');
  });
});

describe('ProjectDetailsPage status changes from the main list', () => {
  it('marks an article as read', async () => {
    const service = givenProject([article({ id: 1, title: 'Artigo novo' })]);
    await renderProjectPage(service);

    fireEvent.click(inRow('Artigo novo').getByTitle('Marcar como Lido'));

    expect(await screen.findByText('Artigos Lidos (1)')).toBeInTheDocument();
    expect(service.updateArticleStatus).toHaveBeenCalledWith(1, 'read', undefined);
  });

  it('archives with the reason given in the modal', async () => {
    const service = givenProject([article({ id: 1, title: 'Artigo novo' })]);
    await renderProjectPage(service);

    fireEvent.click(inRow('Artigo novo').getByTitle('Arquivar'));
    fireEvent.change(screen.getByPlaceholderText('Por que este artigo não é relevante?'), {
      target: { value: 'duplicado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Arquivamento' }));

    expect(await screen.findByText('Motivo: duplicado')).toBeInTheDocument();
    expect(service.updateArticleStatus).toHaveBeenCalledWith(1, 'archived', 'duplicado');
  });

  it('alerts and keeps the article when the status update fails', async () => {
    const service = givenProject([article({ id: 1, title: 'Artigo novo' })]);
    service.updateArticleStatus.mockRejectedValue(new Error('locked'));
    await renderProjectPage(service);

    fireEvent.click(inRow('Artigo novo').getByTitle('Marcar como Lido'));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao atualizar status do artigo: locked'));
    expect(screen.queryByText('Artigos Lidos (1)')).not.toBeInTheDocument();
  });
});

describe('ProjectDetailsPage multi-select', () => {
  const articles = [
    article({ id: 1, title: 'Artigo um' }),
    article({ id: 2, title: 'Artigo dois' }),
    article({ id: 3, title: 'Artigo três' }),
  ];
  const selectArticles = (...titles: string[]) => {
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    titles.forEach((t) => fireEvent.click(screen.getByRole('checkbox', { name: `Selecionar "${t}"` })));
  };
  const bar = () => within(screen.getByRole('region', { name: 'Ações para os artigos selecionados' }));

  it('archives the selected articles with one shared reason in a single call', async () => {
    const service = givenProject(articles);
    await renderProjectPage(service);
    selectArticles('Artigo um', 'Artigo três');

    fireEvent.click(bar().getByRole('button', { name: /Arquivar/ }));
    fireEvent.change(screen.getByPlaceholderText('Por que estes artigos não são relevantes?'), {
      target: { value: 'fora do escopo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar 2' }));

    // The ids follow the list order, which depends on the saved sort; only which ones matters.
    await waitFor(() => expect(service.updateArticlesStatus).toHaveBeenCalledTimes(1));
    const [ids, status, reason] = service.updateArticlesStatus.mock.calls[0];
    expect([[...ids].sort(), status, reason]).toEqual([[1, 3], 'archived', 'fora do escopo']);
    expect(within(mainTable()).queryByText('Artigo um')).not.toBeInTheDocument();
    expect(within(mainTable()).getByText('Artigo dois')).toBeInTheDocument();
    expect(bar().getByText('Nenhum selecionado')).toBeInTheDocument();
  });

  it('marks the selected articles as read', async () => {
    const service = givenProject(articles);
    await renderProjectPage(service);
    selectArticles('Artigo dois');

    fireEvent.click(bar().getByRole('button', { name: /Marcar como lido/ }));

    await waitFor(() => expect(service.updateArticlesStatus).toHaveBeenCalledWith([2], 'read', undefined));
    await waitFor(() => expect(within(mainTable()).queryByText('Artigo dois')).not.toBeInTheDocument());
  });

  it('alerts and keeps the articles when the batch update fails', async () => {
    const service = givenProject(articles);
    service.updateArticlesStatus.mockRejectedValue(new Error('SQLITE_BUSY'));
    await renderProjectPage(service);
    selectArticles('Artigo dois');

    fireEvent.click(bar().getByRole('button', { name: /Marcar como lido/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao atualizar status dos artigos: SQLITE_BUSY'));
    expect(within(mainTable()).getByText('Artigo dois')).toBeInTheDocument();
  });
});

describe('ProjectDetailsPage PDF links', () => {
  const withPdf = [article({ id: 1, title: 'Artigo com PDF', local_file_path: '/lib/a.pdf' })];

  it('unlinks after confirmation and reloads', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const service = givenProject(withPdf);
    await renderProjectPage(service);

    chooseFromRowMenu('Artigo com PDF', 'Desvincular PDF');

    await waitFor(() => expect(service.unlinkPdf).toHaveBeenCalledWith(1));
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('does nothing when the user declines', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const service = givenProject(withPdf);
    await renderProjectPage(service);

    chooseFromRowMenu('Artigo com PDF', 'Desvincular PDF');

    expect(service.unlinkPdf).not.toHaveBeenCalled();
  });

  it('alerts when unlinking fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const service = givenProject(withPdf);
    service.unlinkPdf.mockRejectedValue(new Error('EBUSY'));
    await renderProjectPage(service);

    chooseFromRowMenu('Artigo com PDF', 'Desvincular PDF');

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao desvincular o PDF'));
  });

  it('opens the attach dialog for an article without a PDF', async () => {
    await renderProjectPage(givenProject([article({ id: 4, title: 'Artigo sem PDF' })]));

    fireEvent.click(inRow('Artigo sem PDF').getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Do computador…' }));

    expect(await screen.findByText('Anexar PDF ao Artigo')).toBeInTheDocument();
    expect(screen.getByText('Artigo sem PDF', { selector: 'strong' })).toBeInTheDocument();
  });
});
