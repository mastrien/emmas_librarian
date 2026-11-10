import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectArticlesList } from '../components/ProjectArticlesList';
import { MemoryRouter } from 'react-router-dom';
import type { Article } from '../../../types';

const article = (extra: Partial<Article> & { id: number }): Article =>
  ({ project_id: 1, title: `Article ${extra.id}`, status: 'new', ...extra }) as Article;

describe('ProjectArticlesList', () => {
  const defaultProps = {
    paginatedArticles: [] as Article[],
    setSelectedArticleForDetails: vi.fn(),
    handleUnlinkClick: vi.fn(),
    handleUploadClick: vi.fn(),
    handleStatusChange: vi.fn(),
    setEditingArticle: vi.fn(),
    setArchivingId: vi.fn(),
    setCitationArticle: vi.fn(),
    onExploreCitations: vi.fn(),
    openAccess: { stateOf: () => undefined, onFind: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props: Partial<typeof defaultProps> & { currentIndex?: number } = {}) =>
    render(
      <MemoryRouter>
        <ProjectArticlesList {...defaultProps} {...props} />
      </MemoryRouter>,
    );

  // Status, reading and reference actions live in the row's "⋯" menu (board 153).
  const chooseFromRowMenu = (item: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
  };

  it('says so when the list is empty', () => {
    renderComponent();
    expect(screen.getByText('Nenhum artigo nesta lista.')).toBeInTheDocument();
  });

  it('shows article, year, bases, PDF and the actions menu', () => {
    renderComponent({
      paginatedArticles: [
        article({ id: 1, authors: 'Silva, A.', journal: 'Nature', year: 2021, source_databases: '["Web of Science"]' }),
      ],
    });

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Artigo',
      'Ano',
      'Bases',
      'PDF',
      '',
    ]);
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Article 1');
    expect(cells[0]).toHaveTextContent('Silva, A. · Nature');
    expect(cells[1]).toHaveTextContent('2021');
    expect(within(cells[2]).getByLabelText('Web of Science')).toHaveTextContent('WoS');
    expect(within(cells[3]).getByRole('button', { name: 'Vincular PDF' })).toBeInTheDocument();
    expect(within(cells[4]).getByRole('button', { name: 'Mais ações' })).toBeInTheDocument();
  });

  it('opens the details from the title', () => {
    const a = article({ id: 1 });
    renderComponent({ paginatedArticles: [a] });

    fireEvent.click(screen.getByRole('button', { name: 'Article 1' }));

    expect(defaultProps.setSelectedArticleForDetails).toHaveBeenCalledWith(a);
  });

  it('marks the row the keyboard moved to', () => {
    renderComponent({ paginatedArticles: [article({ id: 1 }), article({ id: 2 })], currentIndex: 1 });

    const rows = screen.getAllByRole('row');
    expect(rows[2]).toHaveClass('is-current');
    expect(rows[2]).toHaveAttribute('aria-current', 'true');
    expect(rows[1]).not.toHaveClass('is-current');
  });

  it('unlinks the PDF of an article that has one', () => {
    renderComponent({ paginatedArticles: [article({ id: 1, local_file_path: '/a.pdf' })] });

    chooseFromRowMenu('Desvincular PDF');

    expect(defaultProps.handleUnlinkClick).toHaveBeenCalledWith(1);
  });

  it('attaches a PDF from the computer to an article without one', () => {
    renderComponent({ paginatedArticles: [article({ id: 1 })] });

    fireEvent.click(screen.getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Do computador…' }));

    expect(defaultProps.handleUploadClick).toHaveBeenCalledWith(1);
  });

  it.each([
    [{ status: 'new' as const }, 'Marcar como Lido', 'read'],
    [{ status: 'read' as const }, 'Desmarcar como Lido', 'new'],
    [{ status: 'archived' as const }, 'Restaurar Artigo', 'new'],
  ])('changes the status from the menu (%o → %s)', (extra, item, status) => {
    renderComponent({ paginatedArticles: [article({ id: 1, ...extra })] });

    chooseFromRowMenu(item);

    expect(defaultProps.handleStatusChange).toHaveBeenCalledWith(1, status);
  });

  it('asks for the archive reason from the menu', () => {
    renderComponent({ paginatedArticles: [article({ id: 1 })] });

    chooseFromRowMenu('Arquivar');

    expect(defaultProps.setArchivingId).toHaveBeenCalledWith(1);
  });

  it('offers metadata editing and citation for every article', () => {
    const a = article({ id: 1, source_databases: '["Scopus"]' });
    renderComponent({ paginatedArticles: [a] });

    chooseFromRowMenu('Editar Metadados');
    chooseFromRowMenu('Gerar Citação');

    expect(defaultProps.setEditingArticle).toHaveBeenCalledWith(a);
    expect(defaultProps.setCitationArticle).toHaveBeenCalledWith(a);
  });
});
