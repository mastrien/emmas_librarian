import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticleDetailsModal } from '../ArticleDetailsModal';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type { Article, SearchHistoryItem } from '../../../types';
import { FakeDialogs, withFakeDialogs } from '../../common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
const renderWithDialogs = (ui: React.ReactElement) => render(ui, { wrapper: withFakeDialogs(dialogs) });
beforeEach(() => {
  dialogs = new FakeDialogs();
});

const baseArticle = { id: 1, project_id: 1, title: 'Paper', status: 'new' } as Article;

let service: FakeProjectService;

const modal = (article: Article | null, isOpen = true, history: SearchHistoryItem[] = []) => (
  <ServicesProvider apiService={service}>
    <MemoryRouter>
      <ArticleDetailsModal isOpen={isOpen} onClose={vi.fn()} article={article} history={history} />
    </MemoryRouter>
  </ServicesProvider>
);

const renderArticle = (overrides: Partial<Article>) => renderWithDialogs(modal({ ...baseArticle, ...overrides }));
const valueUnder = (label: string) => screen.getByText(label).nextElementSibling as HTMLElement;

beforeEach(() => {
  service = FakeProjectService.create();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ArticleDetailsModal lifecycle', () => {
  it('opens after rendering closed without a hook order warning', () => {
    const consoleError = vi.spyOn(console, 'error');
    const { rerender } = renderWithDialogs(modal(null, false));

    rerender(modal(baseArticle, true));

    expect(screen.getByText('Paper')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('order of Hooks'), expect.anything());
  });
});

describe('ArticleDetailsModal metadata', () => {
  it('shows a source stored as a single JSON string', () => {
    renderArticle({ source_databases: '"Scopus"' });

    expect(screen.getByText('Scopus')).toBeInTheDocument();
  });

  it.each([
    [{ volume: '1', issue: '2', pages: '3-4' }, 'v. 1, n. 2, p. 3-4'],
    [{ pages: '3-4' }, 'p. 3-4'],
    [{ issue: '2' }, 'n. 2'],
    [{ volume: '7', pages: '9' }, 'v. 7, p. 9'],
    [{}, 'N/A'],
  ])('formats volume, issue and pages %o as "%s"', (fields, expected) => {
    renderArticle(fields);

    expect(valueUnder('VOLUME / EDIÇÃO / PÁGINAS').textContent).toBe(expected);
  });

  it('shows zero citations when the count is unknown', () => {
    renderArticle({ citation_count: undefined });

    expect(valueUnder('CITAÇÕES')).toHaveTextContent('🎓 0');
  });

  // Crossref and WoS do not report open access; showing "Fechado" there would be a guess.
  it('shows no access pill, no DOI and no ISSN when the source did not report them', () => {
    renderArticle({});

    expect(screen.queryByText('Acesso Fechado')).not.toBeInTheDocument();
    expect(screen.queryByText('Acesso Aberto')).not.toBeInTheDocument();
    expect(valueUnder('DOI')).toHaveTextContent('N/A');
    expect(screen.queryByText('ISSN')).not.toBeInTheDocument();
  });

  it('underlines the DOI link on hover', () => {
    renderArticle({ doi: '10.1/x' });
    const link = screen.getByRole('link', { name: '10.1/x' });

    fireEvent.mouseEnter(link);
    expect(link.style.textDecoration).toBe('underline');
    fireEvent.mouseLeave(link);
    expect(link.style.textDecoration).toBe('none');
  });

  // The window is the shared Modal (Arca 134): its X is named, and the title is the article's.
  it('takes the article title as the window title, with a named X', () => {
    renderArticle({});

    expect(screen.getByRole('dialog', { name: 'Detalhes do artigo' })).toHaveTextContent('Paper');
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });
});

describe('ArticleDetailsModal sections', () => {
  it('marks articles without a search as manual entries', () => {
    renderArticle({ search_id: undefined });

    expect(screen.getByText('Cadastro Manual ⚠️')).toBeInTheDocument();
  });

  it('shows only the keyword groups that have entries, ignoring blanks', () => {
    renderArticle({ author_keywords: 'a; ;b;', index_keywords: ' ; ' });

    expect(screen.getByText(/PALAVRAS-CHAVE DO AUTOR/)).toBeInTheDocument();
    expect(screen.queryByText(/PALAVRAS-CHAVE INDEXADAS/)).not.toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('hides keywords, affiliations and references when absent and shows a default abstract', () => {
    renderArticle({});

    expect(screen.queryByText(/PALAVRAS-CHAVE/)).not.toBeInTheDocument();
    expect(screen.queryByText('AFILIAÇÕES')).not.toBeInTheDocument();
    expect(screen.queryByText('REFERÊNCIAS CITADAS')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum resumo disponível para este artigo.')).toBeInTheDocument();
  });

  it('lists references split on semicolons', () => {
    renderArticle({ references_list: ' A ; B' });

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A', 'B']);
  });

  it('reports the unlink failure message', async () => {
    service.unlinkPdf.mockRejectedValue(new Error('locked'));
    renderArticle({ local_file_path: '/a.pdf' });

    fireEvent.click(screen.getByText('Desvincular PDF'));

    await waitFor(() =>
      expect(dialogs.informed).toContainEqual(
        expect.objectContaining({ message: 'O PDF continua ligado ao artigo.', details: 'locked' }),
      ),
    );
  });
});
