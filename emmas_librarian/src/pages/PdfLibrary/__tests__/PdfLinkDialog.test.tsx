import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Article, Project } from '../../../types';
import { PdfLinkDialog, type PdfLinkDialogProps } from '../PdfLinkDialog';

const PDF = { id: 1, file_path: '/a.pdf', file_hash: 'h', filename: 'a.pdf', file_size: 1, created_at: '', articles: [] };
const PROJECT = { id: 3, name: 'Tese', created_at: '' } as Project;
const ARTICLE = { id: 9, title: 'Artigo sem PDF' } as Article;

function renderDialog(overrides: Partial<PdfLinkDialogProps> = {}) {
  const props: PdfLinkDialogProps = {
    pdf: PDF,
    projects: [PROJECT],
    projectId: 3,
    onProjectChange: vi.fn(),
    articles: [ARTICLE],
    articleId: '',
    onArticleChange: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<PdfLinkDialog {...props} />);
  return props;
}

describe('PdfLinkDialog', () => {
  it('links only once an article is chosen', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Vincular PDF' })).toBeDisabled();
  });

  it('confirms the chosen article', () => {
    const props = renderDialog({ articleId: 9 });

    fireEvent.click(screen.getByRole('button', { name: 'Vincular PDF' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels from its X, Esc and Cancelar', () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.onCancel).toHaveBeenCalledTimes(3);
  });

  it('says when the project has no article without a PDF', () => {
    renderDialog({ articles: [] });
    expect(screen.getByText(/Nenhum artigo sem PDF neste projeto/)).toBeInTheDocument();
  });
});
