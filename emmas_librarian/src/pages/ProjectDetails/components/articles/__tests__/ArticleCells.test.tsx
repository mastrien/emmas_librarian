import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ArticleSummary, articleByline } from '../ArticleCells';
import type { Article } from '../../../../../types';

const article = (extra: Partial<Article> = {}): Article =>
  ({ id: 1, project_id: 1, title: 'Radar e chuva', status: 'new', ...extra }) as Article;

describe('articleByline', () => {
  it('lists the first three authors, how many more, and the venue', () => {
    const byline = articleByline({ authors: 'A, A.; B, B.; C, C.; D, D.; E, E.', journal: 'Nature' });

    expect(byline).toBe('A, A.; B, B.; C, C.; +2 · Nature');
  });

  it('says so when there are no authors and leaves out a missing venue', () => {
    expect(articleByline({ authors: '' })).toBe('Autores desconhecidos');
    expect(articleByline({ authors: 'Silva, A.' })).toBe('Silva, A.');
  });
});

describe('ArticleSummary', () => {
  it('opens the details from the title and puts the whole byline in its tooltip', () => {
    const onOpenDetails = vi.fn();
    const a = article({ authors: 'Silva, A.', journal: 'Nature' });
    render(<ArticleSummary article={a} onOpenDetails={onOpenDetails} />);

    fireEvent.click(screen.getByRole('button', { name: 'Radar e chuva' }));

    expect(onOpenDetails).toHaveBeenCalledWith(a);
    expect(screen.getByText('Silva, A. · Nature')).toHaveAttribute('title', 'Silva, A. · Nature');
  });

  it('says why an archived article was archived', () => {
    render(
      <ArticleSummary
        article={article({ status: 'archived', archive_note: 'fora do escopo' })}
        onOpenDetails={vi.fn()}
      />,
    );

    expect(screen.getByText('Motivo: fora do escopo')).toBeInTheDocument();
  });

  it('shows the result of an open access search under the title', () => {
    render(
      <ArticleSummary
        article={article()}
        onOpenDetails={vi.fn()}
        openAccess={{ status: 'downloaded', source: 'Repositório E2E' }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Repositório E2E');
  });
});
