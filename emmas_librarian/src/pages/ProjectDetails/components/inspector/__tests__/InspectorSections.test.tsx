import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Article, SearchHistoryItem } from '../../../../../types';
import { InspectorOrigin, InspectorText } from '../InspectorSections';

const article = (over: Partial<Article>): Article => ({ id: 1, title: 'A', status: 'new', ...over }) as Article;
const search = (id: number, unified_query: string): SearchHistoryItem =>
  ({
    id,
    unified_query,
    translated_queries: '{}',
    total_results: 1,
    results_breakdown: '{}',
    created_at: '',
  }) as SearchHistoryItem;

describe('InspectorText', () => {
  it('shows the abstract under "Resumo", or says there is none', () => {
    const { rerender } = render(<InspectorText article={article({ abstract: 'Um resumo.' })} />);
    expect(screen.getByText('Resumo')).toBeInTheDocument();
    expect(screen.getByText('Um resumo.')).toBeInTheDocument();

    rerender(<InspectorText article={article({})} />);
    expect(screen.getByText('Nenhum resumo disponível para este artigo.')).toBeInTheDocument();
  });

  it('lists the keywords as chips and leaves out the groups that are empty', () => {
    render(<InspectorText article={article({ author_keywords: 'rain; radar', index_keywords: '' })} />);

    expect(screen.getByText('Palavras-chave do autor')).toBeInTheDocument();
    expect(screen.getByText('radar')).toBeInTheDocument();
    expect(screen.queryByText('Palavras-chave indexadas')).not.toBeInTheDocument();
  });

  it('numbers the cited references, one per item', () => {
    render(<InspectorText article={article({ references_list: 'Ref A; Ref B' })} />);

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ref A', 'Ref B']);
  });
});

describe('InspectorOrigin', () => {
  it('links to the history from the search that brought the article', () => {
    const onShowHistory = vi.fn();
    render(<InspectorOrigin searchId={2} history={[search(2, 'radar')]} onShowHistory={onShowHistory} />);

    fireEvent.click(screen.getByRole('button', { name: 'Busca #2' }));

    expect(onShowHistory).toHaveBeenCalledOnce();
  });

  it('names an import as such', () => {
    render(<InspectorOrigin searchId={3} history={[search(3, 'Importação de arquivo')]} onShowHistory={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Importação #3' })).toBeInTheDocument();
  });

  it('says a manual entry is manual', () => {
    render(<InspectorOrigin history={[]} onShowHistory={vi.fn()} />);

    expect(screen.getByText('Cadastro manual')).toBeInTheDocument();
  });
});
