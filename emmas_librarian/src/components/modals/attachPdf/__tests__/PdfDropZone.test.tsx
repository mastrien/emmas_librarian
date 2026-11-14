import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PdfDropZone } from '../PdfDropZone';

const pdf = (name = 'artigo.pdf') => new File(['%PDF'], name, { type: 'application/pdf' });

// The modal is rendered inside the project page, whose own handlers import every PDF dropped on the page.
function renderInsidePage() {
  const page = { onDrop: vi.fn(), onDragOver: vi.fn() };
  const zone = { onPick: vi.fn(), onChoose: vi.fn(), onRejected: vi.fn() };
  render(
    <div {...page} data-testid="page">
      <PdfDropZone {...zone} />
    </div>,
  );
  return { page, zone, area: screen.getByText('Solte o PDF aqui').closest('.pdf-drop') as HTMLElement };
}

describe('PdfDropZone', () => {
  it('hands the dropped PDF to the window and does not let the page import it too', () => {
    const { page, zone, area } = renderInsidePage();

    fireEvent.drop(area, { dataTransfer: { files: [pdf()] } });

    expect(zone.onPick).toHaveBeenCalledTimes(1);
    expect(page.onDrop).not.toHaveBeenCalled();
  });

  it('keeps the drag over it from lighting the page overlay', () => {
    const { page, area } = renderInsidePage();

    fireEvent.dragOver(area, { dataTransfer: { types: ['Files'] } });

    expect(page.onDragOver).not.toHaveBeenCalled();
  });

  it('rejects a file that is not a PDF, still without reaching the page', () => {
    const { page, zone, area } = renderInsidePage();

    fireEvent.drop(area, { dataTransfer: { files: [pdf('notas.docx')] } });

    expect(zone.onRejected).toHaveBeenCalledTimes(1);
    expect(zone.onPick).not.toHaveBeenCalled();
    expect(page.onDrop).not.toHaveBeenCalled();
  });
});
