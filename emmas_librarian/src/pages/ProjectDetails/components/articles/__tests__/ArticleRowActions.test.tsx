import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ArticleRowActions, type ArticleRowHandlers } from '../ArticleRowActions';
import type { Article } from '../../../../../types';

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

const article = (overrides: Partial<Article> = {}): Article => ({
  id: 7,
  project_id: 1,
  title: 'Radar e chuva',
  status: 'new',
  ...overrides,
});

function renderActions(overrides: Partial<Article> = {}, outsideSearch = false) {
  const handlers: ArticleRowHandlers = {
    onUpload: vi.fn(),
    onFindOpenAccess: vi.fn(),
    onUnlink: vi.fn(),
    onStatusChange: vi.fn(),
    onEdit: vi.fn(),
    onArchive: vi.fn(),
    onCite: vi.fn(),
    onExploreCitations: vi.fn(),
  };
  const a = article(overrides);
  render(
    <MemoryRouter initialEntries={['/projects/1/articles']}>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
      <table>
        <tbody>
          <tr>
            <td>
              <ArticleRowActions article={a} handlers={handlers} outsideSearch={outsideSearch} />
            </td>
          </tr>
        </tbody>
      </table>
    </MemoryRouter>,
  );
  return { handlers, article: a };
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
const menuLabels = () => screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());

describe('ArticleRowActions menu', () => {
  // Board 153: the row has only "⋯", so the status comes first in it.
  it('puts the status first, then reading, then the reference tools', () => {
    renderActions({ local_file_path: '/lib/a.pdf', doi: '10.1/x' });

    openMenu();

    expect(menuLabels()).toEqual([
      'Marcar como Lido',
      'Arquivar',
      'Ler o PDF',
      'Abrir pelo DOI',
      'Desvincular PDF',
      'Editar Metadados',
      'Gerar Citação',
      'Explorar citações',
    ]);
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Organização',
      'Leitura',
      'Referência',
    ]);
  });

  it('offers to unmark a read article and only to restore an archived one', () => {
    renderActions({ status: 'read' });
    openMenu();
    expect(menuLabels().slice(0, 2)).toEqual(['Desmarcar como Lido', 'Arquivar']);
  });

  it('restores an archived article', () => {
    const { handlers } = renderActions({ status: 'archived' });
    openMenu();

    expect(screen.getByRole('group', { name: 'Organização' })).toHaveTextContent('Restaurar Artigo');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restaurar Artigo' }));

    expect(handlers.onStatusChange).toHaveBeenCalledWith(7, 'new');
  });

  it('opens the reader and the DOI page from the reading group', () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    renderActions({ local_file_path: '/lib/a.pdf', doi: '10.1/x' });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Abrir pelo DOI' }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ler o PDF' }));

    expect(opened).toHaveBeenCalledWith('https://doi.org/10.1/x', '_blank');
    expect(screen.getByTestId('location')).toHaveTextContent('/articles/7');
    opened.mockRestore();
  });

  it('has no "Leitura" section without a PDF or a DOI', () => {
    renderActions();

    openMenu();

    expect(screen.queryByRole('group', { name: 'Leitura' })).not.toBeInTheDocument();
  });

  it('offers to explore the citations of the article (#51)', () => {
    const { handlers, article: a } = renderActions();
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Explorar citações' }));

    expect(handlers.onExploreCitations).toHaveBeenCalledWith(a);
  });

  it('runs the chosen action, closes and returns focus to the button', () => {
    const { handlers, article: a } = renderActions();
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Gerar Citação' }));

    expect(handlers.onCite).toHaveBeenCalledWith(a);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toHaveFocus();
  });

  it('focuses the first item on open and moves with the arrow keys', () => {
    renderActions();
    openMenu();
    const items = screen.getAllByRole('menuitem');

    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(items[items.length - 1]).toHaveFocus();
  });

  it('closes on Escape and on a click outside', () => {
    renderActions();

    openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toHaveFocus();

    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles closed when the "⋯" button is clicked again', () => {
    renderActions();

    openMenu();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toHaveAttribute('aria-expanded', 'true');
    openMenu();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

// #67: there is no delete button; an article from outside the searches leaves with its history entry.
describe('ArticleRowActions hint for articles from outside the searches', () => {
  const HINT = 'se quiser excluir este artigo, desfaça a inclusão dele no histórico';

  it('ends the menu of an article added by hand with how to remove it, as text and not an action', () => {
    renderActions({}, true);
    openMenu();

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText(HINT)).toHaveClass('row-menu__footnote');
    expect(within(menu).queryByRole('menuitem', { name: new RegExp(HINT) })).not.toBeInTheDocument();
  });

  it('says nothing of the kind for an article from a structured search', () => {
    renderActions();
    openMenu();

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
