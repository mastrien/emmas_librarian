import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticleRowActions, type ArticleRowHandlers } from '../ArticleRowActions';
import type { Article } from '../../../../../types';

const article = (overrides: Partial<Article> = {}): Article => ({
  id: 7,
  project_id: 1,
  title: 'Radar e chuva',
  status: 'new',
  ...overrides,
});

function renderActions(overrides: Partial<Article> = {}) {
  const handlers: ArticleRowHandlers = {
    onUpload: vi.fn(),
    onFindOpenAccess: vi.fn(),
    onUnlink: vi.fn(),
    onStatusChange: vi.fn(),
    onEdit: vi.fn(),
    onArchive: vi.fn(),
    onCite: vi.fn(),
  };
  const a = article(overrides);
  render(
    <MemoryRouter>
      <table>
        <tbody>
          <tr>
            <td>
              <ArticleRowActions article={a} handlers={handlers} />
            </td>
          </tr>
        </tbody>
      </table>
    </MemoryRouter>,
  );
  return { handlers, article: a };
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
const shortcuts = () => within(screen.getByRole('toolbar', { name: 'Atalhos' }));

describe('ArticleRowActions main line', () => {
  it('opens the reader when the article has a PDF', () => {
    renderActions({ local_file_path: '/lib/a.pdf' });

    expect(screen.getByRole('link', { name: 'Ler' })).toHaveAttribute('href', '/articles/7');
  });

  // "Vincular PDF" offers both ways to get the PDF (option B of the open access mock-up).
  it('offers to attach a PDF from the computer or to look for an open access copy', () => {
    const { handlers } = renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Do computador…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Buscar PDF aberto' }));

    expect(handlers.onUpload).toHaveBeenCalledWith(7);
    expect(handlers.onFindOpenAccess).toHaveBeenCalledWith(7);
  });

  it('keeps the DOI button always visible, pointing to doi.org', () => {
    renderActions({ doi: '10.1016/j.x' });

    expect(screen.getByRole('link', { name: 'DOI' })).toHaveAttribute('href', 'https://doi.org/10.1016/j.x');
  });

  it('shows no DOI button for an article without DOI', () => {
    renderActions();

    expect(screen.queryByRole('link', { name: 'DOI' })).not.toBeInTheDocument();
  });
});

describe('ArticleRowActions shortcuts', () => {
  it('labels the shortcuts "Lido" and "Arquivar" for an active article', () => {
    const { handlers } = renderActions();

    fireEvent.click(shortcuts().getByRole('button', { name: 'Lido' }));
    fireEvent.click(shortcuts().getByRole('button', { name: 'Arquivar' }));

    expect(handlers.onStatusChange).toHaveBeenCalledWith(7, 'read');
    expect(handlers.onArchive).toHaveBeenCalledWith(7);
  });

  it('offers "Desmarcar" for a read article', () => {
    const { handlers } = renderActions({ status: 'read' });

    fireEvent.click(shortcuts().getByRole('button', { name: 'Desmarcar' }));

    expect(handlers.onStatusChange).toHaveBeenCalledWith(7, 'new');
  });

  it('only offers "Restaurar" for an archived article', () => {
    const { handlers } = renderActions({ status: 'archived' });

    fireEvent.click(shortcuts().getByRole('button', { name: 'Restaurar' }));

    expect(shortcuts().getAllByRole('button')).toHaveLength(1);
    expect(handlers.onStatusChange).toHaveBeenCalledWith(7, 'new');
  });
});

describe('ArticleRowActions menu', () => {
  it('groups the actions and leaves the DOI out, since it has its own button', () => {
    renderActions({ local_file_path: '/lib/a.pdf', doi: '10.1/x' });

    openMenu();

    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());
    expect(labels).toEqual(['Desvincular PDF', 'Marcar como Lido', 'Arquivar', 'Editar Metadados', 'Gerar Citação']);
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Leitura',
      'Organização',
      'Referência',
    ]);
  });

  it('has no "Leitura" section when there is no PDF to unlink', () => {
    renderActions();

    openMenu();

    expect(screen.queryByRole('group', { name: 'Leitura' })).not.toBeInTheDocument();
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
