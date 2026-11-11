import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Article } from '../../../types';
import { ArticleReaderToolbar } from '../components/ArticleReaderToolbar';
import { toolbarProps } from './toolbarProps';

const study = { id: 1, project_id: 3, title: 'ERA5', status: 'new', local_file_path: 'a.pdf' } as Article;

const renderBar = (overrides: Parameters<typeof toolbarProps>[1] = {}) => {
  const props = toolbarProps(study, overrides);
  render(
    <MemoryRouter>
      <ArticleReaderToolbar {...props} />
    </MemoryRouter>,
  );
  return props;
};

// Board 169: one 48px bar with the page, the zoom, the highlight colour and the article's actions.
describe('ArticleReaderToolbar (board 169)', () => {
  it('goes to the previous and next page, and only inside the document', () => {
    const props = renderBar({ currentPage: 1, numPages: 3 });

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(props.goToPage).toHaveBeenCalledWith(2);
    expect(screen.getByText('/ 3')).toBeInTheDocument();
  });

  it('goes to a typed page with Enter, and puts the real page back when it is out of range', () => {
    const props = renderBar({ inputPage: '7', numPages: 10 });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Página atual' }), { key: 'Enter' });
    expect(props.goToPage).toHaveBeenCalledWith(7);

    const outside = renderBar({ inputPage: '99', numPages: 10, currentPage: 4 });
    fireEvent.keyDown(screen.getAllByRole('textbox', { name: 'Página atual' })[1], { key: 'Enter' });

    expect(outside.goToPage).not.toHaveBeenCalled();
    expect(outside.setInputPage).toHaveBeenCalledWith('4');
  });

  it('waits for the PDF before offering the page navigation', () => {
    renderBar({ numPages: 0 });

    expect(screen.queryByRole('textbox', { name: 'Página atual' })).not.toBeInTheDocument();
  });

  it('zooms, and the level takes it back to 100%', () => {
    const props = renderBar({ scale: 1.1 });

    fireEvent.click(screen.getByRole('button', { name: 'Mais zoom' }));
    fireEvent.click(screen.getByRole('button', { name: '110%' }));

    expect(props.handleZoom).toHaveBeenCalledTimes(2);
    expect(props.handleZoom).toHaveBeenLastCalledWith(1.0);
  });

  it('chooses the colour a new highlight starts with', () => {
    const props = renderBar({ highlightColor: 'yellow' });
    const colours = screen.getByRole('group', { name: 'Cor do grifo' });

    expect(within(colours).getByRole('button', { name: 'Grifar em yellow' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(colours).getByRole('button', { name: 'Grifar em lightblue' }));

    expect(props.setHighlightColor).toHaveBeenCalledWith('lightblue');
  });

  it('marks as read, and says "Lido" once it is, to take it back', () => {
    const props = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Marcar como lido/ }));
    expect(props.onToggleRead).toHaveBeenCalled();

    renderBar({ isRead: true });
    expect(screen.getByRole('button', { name: /^Lido/ })).toBeInTheDocument();
  });

  it('does not offer to mark an archived article as read', () => {
    renderBar({ canMarkRead: false });

    expect(screen.queryByRole('button', { name: /Marcar como lido|^Lido/ })).not.toBeInTheDocument();
  });

  it('opens the categories and toggles the side panel', () => {
    const props = renderBar();

    fireEvent.click(screen.getByRole('button', { name: /Categorias/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Painel lateral' }));

    expect(props.onToggleCategories).toHaveBeenCalled();
    expect(props.onToggleSidebar).toHaveBeenCalled();
  });

  it('offers to link a PDF, and leaves out the PDF controls, when the article has none', () => {
    const props = renderBar({ hasLocalFile: false });

    fireEvent.click(screen.getByRole('button', { name: /Vincular PDF Local/ }));

    expect(props.handleFileUpload).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Mais zoom' })).not.toBeInTheDocument();
    expect(vi.isMockFunction(props.handleZoom)).toBe(true);
  });
});
