import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticleInspector } from '../ArticleInspector';
import type { ArticleRowHandlers } from '../../articles/ArticleRowActions';
import type { Article } from '../../../../../types';

const handlersDouble = (): ArticleRowHandlers => ({
  onUpload: vi.fn(),
  onFindOpenAccess: vi.fn(),
  onUnlink: vi.fn(),
  onStatusChange: vi.fn(),
  onEdit: vi.fn(),
  onArchive: vi.fn(),
  onCite: vi.fn(),
  onExploreCitations: vi.fn(),
});

function renderInspector(extra: Partial<Article> = {}) {
  const handlers = handlersDouble();
  const onClose = vi.fn();
  const article = {
    id: 7,
    project_id: 1,
    title: 'The ERA5 global reanalysis',
    authors: 'A; B; C; D; E; F; G',
    journal: 'QJRMS',
    year: 2020,
    doi: '10.1002/qj.3803',
    source_databases: '["OpenAlex","Scopus"]',
    is_oa: 1,
    status: 'new',
    abstract: 'Within the Copernicus Climate Change Service…',
    ...extra,
  } as Article;
  render(
    <MemoryRouter>
      <ArticleInspector article={article} handlers={handlers} history={[]} onClose={onClose} onShowHistory={vi.fn()} />
    </MemoryRouter>,
  );
  return {
    handlers,
    onClose,
    article,
    panel: within(screen.getByRole('complementary', { name: 'Detalhes do artigo' })),
  };
}

describe('ArticleInspector', () => {
  it('shows the title, five authors with the count of the rest, and the venue', () => {
    const { panel } = renderInspector();

    expect(panel.getByRole('heading', { name: 'The ERA5 global reanalysis' })).toBeInTheDocument();
    expect(panel.getByText(/A; B; C; D; E/)).toBeInTheDocument();
    expect(panel.getByText('QJRMS · 2020')).toBeInTheDocument();

    fireEvent.click(panel.getByRole('button', { name: '+2 autores' }));
    expect(panel.getByText(/A; B; C; D; E; F; G/)).toBeInTheDocument();
  });

  it('lists the facts as words: DOI, bases, access and status', () => {
    const { panel } = renderInspector({ citation_count: 4 });

    expect(panel.getByRole('link', { name: '10.1002/qj.3803' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1002/qj.3803',
    );
    expect(panel.getByText('OpenAlex · Scopus')).toBeInTheDocument();
    expect(panel.getByText('Aberto')).toBeInTheDocument();
    expect(panel.getByText('Ativo')).toBeInTheDocument();
    expect(panel.getByText('4')).toBeInTheDocument();
    expect(panel.getByText('Within the Copernicus Climate Change Service…')).toBeInTheDocument();
  });

  it('reads the PDF when there is one, and offers to link one when there is not', () => {
    const { panel } = renderInspector({ local_file_path: '/a.pdf' });
    expect(panel.getByRole('link', { name: /Ler PDF/ })).toHaveAttribute('href', '/articles/7');
  });

  it('links a PDF, cites and edits from its buttons', () => {
    const { panel, handlers, article } = renderInspector();

    fireEvent.click(panel.getByRole('button', { name: /Vincular PDF/ }));
    fireEvent.click(panel.getByRole('button', { name: /Citar/ }));
    fireEvent.click(panel.getByRole('button', { name: 'Editar metadados' }));

    expect(handlers.onUpload).toHaveBeenCalledWith(7);
    expect(handlers.onCite).toHaveBeenCalledWith(article);
    expect(handlers.onEdit).toHaveBeenCalledWith(article);
  });

  it('closes from its X', () => {
    const { panel, onClose } = renderInspector();

    fireEvent.click(panel.getByRole('button', { name: 'Fechar detalhes' }));

    expect(onClose).toHaveBeenCalled();
  });
});
