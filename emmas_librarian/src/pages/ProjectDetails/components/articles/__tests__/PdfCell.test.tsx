import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PdfCell } from '../PdfCell';
import type { ArticleRowHandlers } from '../ArticleRowActions';
import type { Article } from '../../../../../types';

function renderCell(extra: Partial<Article> = {}, searching = false) {
  const handlers = {
    onUpload: vi.fn(),
    onFindOpenAccess: vi.fn(),
  } as unknown as ArticleRowHandlers;
  const article = { id: 7, project_id: 1, title: 'Radar', ...extra } as Article;
  render(
    <MemoryRouter>
      <PdfCell article={article} handlers={handlers} searching={searching} />
    </MemoryRouter>,
  );
  return handlers;
}

describe('PdfCell', () => {
  it('links an article with a PDF to the reader', () => {
    renderCell({ local_file_path: '/lib/a.pdf' });

    expect(screen.getByRole('link', { name: 'Ler' })).toHaveAttribute('href', '/articles/7');
  });

  it('offers to attach a PDF from the computer or to look for an open access copy', () => {
    const handlers = renderCell();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Do computador…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Buscar PDF aberto' }));

    expect(handlers.onUpload).toHaveBeenCalledWith(7);
    expect(handlers.onFindOpenAccess).toHaveBeenCalledWith(7);
  });

  it('shows that an open access copy is being searched for', () => {
    renderCell({}, true);

    expect(screen.getByRole('status', { name: 'Buscando PDF…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vincular PDF' })).not.toBeInTheDocument();
  });
});
