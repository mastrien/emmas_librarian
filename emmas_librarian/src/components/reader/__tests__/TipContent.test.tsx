import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TipContent } from '../TipContent';

const position = { pageNumber: 2 };
const content = { text: 'selected' };

function renderTip() {
  const hideTipAndSelection = vi.fn();
  const addHighlight = vi.fn();
  render(
    <TipContent position={position} content={content} hideTipAndSelection={hideTipAndSelection} addHighlight={addHighlight} />,
  );
  return { hideTipAndSelection, addHighlight };
}

const colorSwatch = (color: string) =>
  screen.getAllByRole('button').find((b) => b.style.backgroundColor === color) as HTMLElement;

describe('TipContent', () => {
  it('offers five colors with yellow preselected', () => {
    renderTip();

    const selected = ['yellow', 'lightgreen', 'lightblue', 'lightpink', 'plum'].filter(
      (c) => colorSwatch(c).style.border === '2px solid var(--color-primary)',
    );
    expect(selected).toEqual(['yellow']);
  });

  it('creates a yellow highlight with an empty note by default and closes the tip', () => {
    const { addHighlight, hideTipAndSelection } = renderTip();

    fireEvent.click(screen.getByRole('button', { name: 'Destacar' }));

    expect(addHighlight).toHaveBeenCalledWith({ content, position, comment: { text: '' }, color: 'yellow' });
    expect(hideTipAndSelection).toHaveBeenCalledTimes(1);
  });

  it('uses the chosen color and typed note', () => {
    const { addHighlight } = renderTip();

    fireEvent.click(colorSwatch('plum'));
    fireEvent.change(screen.getByPlaceholderText('Adicionar nota (opcional)...'), { target: { value: 'revisar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Destacar' }));

    expect(colorSwatch('plum').style.border).toBe('2px solid var(--color-primary)');
    expect(addHighlight).toHaveBeenCalledWith({ content, position, comment: { text: 'revisar' }, color: 'plum' });
  });

  it('cancels without creating a highlight', () => {
    const { addHighlight, hideTipAndSelection } = renderTip();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(hideTipAndSelection).toHaveBeenCalledTimes(1);
    expect(addHighlight).not.toHaveBeenCalled();
  });

  it('highlights the note border while focused', () => {
    renderTip();
    const note = screen.getByPlaceholderText('Adicionar nota (opcional)...');

    fireEvent.focus(note);
    expect(note.style.borderColor).toBe('var(--color-primary)');
    fireEvent.blur(note);
    expect(note.style.borderColor).toBe('var(--border-color)');
  });
});
