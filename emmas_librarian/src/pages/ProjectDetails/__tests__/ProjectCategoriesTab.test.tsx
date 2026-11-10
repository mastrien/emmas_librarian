import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectCategoriesTab } from '../components/ProjectCategoriesTab';
import type { Article, ArticleCategory, ProjectCategory } from '../../../types';

// The cell editor (CategoryCell) has tests of its own; here it only shows that it opened, and can report a save.
vi.mock('../../../components/common/CategoryCell', () => ({
  CategoryCell: ({ initialValue, onCategorySaved }: { initialValue: string; onCategorySaved: () => void }) => (
    <button data-testid="category-editor" onClick={onCategorySaved}>
      editor:{initialValue}
    </button>
  ),
}));

const categories: ProjectCategory[] = [
  { id: 1, project_id: 1, name: 'Técnica mencionada', type: 'multiselect' },
  { id: 2, project_id: 1, name: 'A técnica foi eficaz?', type: 'boolean' },
  { id: 3, project_id: 1, name: 'Onde foi feito o estudo?', type: 'text' },
];
const articles = [
  { id: 101, project_id: 1, title: 'Sem categorias' },
  { id: 102, project_id: 1, title: 'Deep Learning for Water' },
] as Article[];
const values = [
  { article_id: 102, category_id: 1, value: 'Transformer, LSTM, Random Forest, BJP', name: '', type: '' },
  { article_id: 102, category_id: 2, value: 'true', name: '', type: '' },
] as ArticleCategory[];

function renderMatrix(extra: Partial<React.ComponentProps<typeof ProjectCategoriesTab>> = {}) {
  const props = {
    projectCategories: categories,
    articleCategories: values,
    nonArchivedArticles: articles,
    onCategorySaved: vi.fn(),
    onManageCategories: vi.fn(),
    ...extra,
  };
  render(<ProjectCategoriesTab {...props} />);
  return props;
}

const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('ProjectCategoriesTab', () => {
  it('heads each column with its kind, how many articles have it and its name', () => {
    renderMatrix();

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Artigo',
      'Várias opções · 1/2Técnica mencionada',
      'Sim ou não · 1/2A técnica foi eficaz?',
      'Texto · 0/2Onde foi feito o estudo?',
    ]);
    expect(screen.getByText('1 de 2 artigos com alguma categoria')).toBeInTheDocument();
  });

  it('shows lists as chips with "+N", yes/no as a labelled badge and missing values as a dash', () => {
    renderMatrix();

    const filled = within(bodyRows()[0]);
    expect(filled.getByText('Transformer')).toBeInTheDocument();
    expect(filled.getByText('+1')).toBeInTheDocument();
    expect(filled.getByText('Sim')).toBeInTheDocument();
    expect(within(bodyRows()[1]).getAllByText('—')).toHaveLength(3);
  });

  it('lists the filled articles first, or the project order on request, and filters by title', () => {
    renderMatrix();
    expect(bodyRows()[0]).toHaveTextContent('Deep Learning for Water');

    fireEvent.click(screen.getByRole('button', { name: 'Ordem do projeto' }));
    expect(bodyRows()[0]).toHaveTextContent('Sem categorias');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar artigos' }), { target: { value: 'water' } });
    expect(bodyRows()).toHaveLength(1);
  });

  it('opens the editor on a click on a cell and goes back to the value after saving', () => {
    const props = renderMatrix();

    fireEvent.click(
      screen.getByRole('button', { name: 'Onde foi feito o estudo? de "Deep Learning for Water": editar' }),
    );
    fireEvent.click(screen.getByTestId('category-editor'));

    expect(props.onCategorySaved).toHaveBeenCalled();
    expect(screen.queryByTestId('category-editor')).not.toBeInTheDocument();
  });

  it('leaves the editor with Escape, keeping the value', () => {
    const props = renderMatrix();
    fireEvent.click(
      screen.getByRole('button', { name: 'Onde foi feito o estudo? de "Deep Learning for Water": editar' }),
    );

    fireEvent.keyDown(screen.getByTestId('category-editor'), { key: 'Escape' });

    expect(screen.queryByTestId('category-editor')).not.toBeInTheDocument();
    expect(props.onCategorySaved).not.toHaveBeenCalled();
  });

  it('explains categories and offers to create the first one when there are none', () => {
    const props = renderMatrix({ projectCategories: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Criar a primeira categoria' }));

    expect(props.onManageCategories).toHaveBeenCalled();
  });
});
