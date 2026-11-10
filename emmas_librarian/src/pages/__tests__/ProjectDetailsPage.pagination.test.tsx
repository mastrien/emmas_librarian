import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { givenProject, renderProjectPage, article } from './support/projectPageHarness';
import type { Article } from '../../types';

// Pagination needs 50+ rows; the real rows (tested in ProjectArticlesList's own suite) make each render take
// seconds under coverage. A title-only list keeps the page's pagination logic and controls real and the test fast.
vi.mock('../ProjectDetails/components/ProjectArticlesList', () => ({
  ProjectArticlesList: ({ paginatedArticles }: { paginatedArticles: Article[] }) => (
    <ul data-testid="main-articles-table">
      {paginatedArticles.map((a) => (
        <li key={a.id}>{a.title}</li>
      ))}
    </ul>
  ),
}));

const many = Array.from({ length: 60 }, (_, i) =>
  article({ id: i + 1, title: `Artigo ${String(i + 1).padStart(2, '0')}` }),
);
const visibleTitles = () =>
  within(screen.getByTestId('main-articles-table'))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

// The PDF and open access options sit in the "Filtros" popover since the redesign (board 153).
const chooseFilter = (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Filtros' })).getByRole('checkbox', { name }));
};

describe('ProjectDetailsPage pagination', () => {
  const previous = () => screen.getByRole('button', { name: 'Página anterior' });
  const next = () => screen.getByRole('button', { name: 'Próxima página' });

  it('shows the first 50 active articles with the pager in the footer', async () => {
    await renderProjectPage(givenProject(many));

    expect(screen.getByText('60 artigos')).toBeInTheDocument();
    expect(visibleTitles()).toHaveLength(50);
    expect(screen.getByText('1–50 de 60')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
  });

  it('moves between pages with the footer pager', async () => {
    await renderProjectPage(givenProject(many));

    fireEvent.click(next());
    expect(screen.getByText('51–60 de 60')).toBeInTheDocument();
    expect(visibleTitles()).toHaveLength(10);
    expect(next()).toBeDisabled();

    fireEvent.click(previous());
    expect(screen.getByText('1–50 de 60')).toBeInTheDocument();
  });

  it.each([
    [
      'searching',
      () =>
        fireEvent.change(screen.getByPlaceholderText('Buscar por título ou autor'), {
          target: { value: 'Artigo' },
        }),
    ],
    ['toggling the PDF filter', () => chooseFilter(/^Com PDF,/)],
    ['toggling the open access filter', () => chooseFilter(/^Acesso aberto,/)],
    [
      'changing the sort order',
      () => fireEvent.change(screen.getByRole('combobox', { name: /Ordenar/ }), { target: { value: 'title-desc' } }),
    ],
  ])('returns to page 1 after %s', async (_label, change) => {
    await renderProjectPage(givenProject(many));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    change();

    expect(screen.queryByText('51–60 de 60')).not.toBeInTheDocument();
  });

  it('counts only active articles, not read or archived ones', async () => {
    const mixed = [...many.slice(0, 50), article({ id: 99, status: 'read' }), article({ id: 98, status: 'archived' })];

    await renderProjectPage(givenProject(mixed));

    expect(screen.getByText('50 artigos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Próxima/ })).not.toBeInTheDocument();
  });
});
