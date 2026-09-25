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

describe('ProjectDetailsPage pagination', () => {
  it('shows the first 50 active articles with the bottom controls', async () => {
    await renderProjectPage(givenProject(many));

    expect(screen.getByText('Mostrando 1-50 de 60 artigos')).toBeInTheDocument();
    expect(visibleTitles()).toHaveLength(50);
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Próxima/ })).toBeEnabled();
    expect(screen.getAllByText('1 / 2')).toHaveLength(2);
  });

  it('moves between pages with the bottom controls', async () => {
    await renderProjectPage(givenProject(many));

    fireEvent.click(screen.getByRole('button', { name: /Próxima/ }));
    expect(screen.getByText('Mostrando 51-60 de 60 artigos')).toBeInTheDocument();
    expect(visibleTitles()).toHaveLength(10);
    expect(screen.getByRole('button', { name: /Próxima/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByText('Mostrando 1-50 de 60 artigos')).toBeInTheDocument();
  });

  it('moves between pages with the compact top controls', async () => {
    await renderProjectPage(givenProject(many));
    const top = () => within(screen.getByText(/^Mostrando/).nextElementSibling as HTMLElement).getAllByRole('button');

    expect(top()[0]).toBeDisabled();
    fireEvent.click(top()[1]);
    expect(screen.getByText('Mostrando 51-60 de 60 artigos')).toBeInTheDocument();
    expect(top()[1]).toBeDisabled();
    fireEvent.click(top()[0]);
    expect(screen.getByText('Mostrando 1-50 de 60 artigos')).toBeInTheDocument();
  });

  it.each([
    [
      'searching',
      () =>
        fireEvent.change(screen.getByPlaceholderText('Filtrar por título ou autor...'), {
          target: { value: 'Artigo' },
        }),
    ],
    ['toggling the PDF filter', () => fireEvent.click(screen.getByLabelText('Apenas com PDF vinculado'))],
    ['toggling the open access filter', () => fireEvent.click(screen.getByLabelText('Apenas Acesso Aberto'))],
    [
      'changing the sort order',
      () => fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title-desc' } }),
    ],
  ])('returns to page 1 after %s', async (_label, change) => {
    await renderProjectPage(givenProject(many));
    fireEvent.click(screen.getByRole('button', { name: /Próxima/ }));

    change();

    expect(screen.queryByText('Mostrando 51-60 de 60 artigos')).not.toBeInTheDocument();
  });

  it('counts only active articles, not read or archived ones', async () => {
    const mixed = [...many.slice(0, 50), article({ id: 99, status: 'read' }), article({ id: 98, status: 'archived' })];

    await renderProjectPage(givenProject(mixed));

    expect(screen.queryByText(/^Mostrando/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Próxima/ })).not.toBeInTheDocument();
  });
});
