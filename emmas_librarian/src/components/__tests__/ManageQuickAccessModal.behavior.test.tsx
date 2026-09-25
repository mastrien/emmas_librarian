import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, createEvent } from '@testing-library/react';
import { ManageQuickAccessModal } from '../modals/ManageQuickAccessModal';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { ProjectDocument } from '../../types';

class FakeDataTransfer {
  private store = new Map<string, string>();
  effectAllowed = '';
  dropEffect = '';
  setData(type: string, value: string) {
    this.store.set(type, value);
  }
  getData(type: string) {
    return this.store.get(type) ?? '';
  }
}

const doc = (id: number, overrides: Partial<ProjectDocument> = {}): ProjectDocument => ({
  id,
  project_id: 10,
  title: `Doc ${id}`,
  url: `https://d${id}.com`,
  created_at: '2026-07-22',
  position: id,
  ...overrides,
});

let service: FakeProjectService;
let onDocumentsChanged: ReturnType<typeof vi.fn>;

const modal = (documents: ProjectDocument[], isOpen = true, onClose = vi.fn()) => (
  <ServicesProvider apiService={service}>
    <ManageQuickAccessModal
      isOpen={isOpen}
      onClose={onClose}
      projectId={10}
      documents={documents}
      onDocumentsChanged={onDocumentsChanged}
    />
  </ServicesProvider>
);

const renderModal = (documents: ProjectDocument[]) => render(modal(documents));
const titleInput = () => screen.getByPlaceholderText('Ex: Trello do Projeto, Edital CAPES');
const urlInput = () => screen.getByPlaceholderText('https://');
const form = () => titleInput().closest('form') as HTMLFormElement;
const rows = () => Array.from(document.querySelectorAll('[draggable]')) as HTMLElement[];
const rowTitles = () => rows().map((row) => row.querySelector('span[style*="font-weight: 600"]')?.textContent);
const gaps = () => screen.queryAllByTestId('quick-access-drop-gap');

beforeEach(() => {
  service = FakeProjectService.create();
  onDocumentsChanged = vi.fn();
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ManageQuickAccessModal lifecycle', () => {
  it('can be opened after rendering closed', () => {
    const { rerender } = render(modal([doc(1)], false));

    rerender(modal([doc(1)], true));

    expect(screen.getByText('Doc 1')).toBeInTheDocument();
  });

  it('closes from the X button', () => {
    const onClose = vi.fn();
    render(modal([], true, onClose));

    fireEvent.click(screen.getByText('Gerenciar Acesso Rápido').nextElementSibling as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the file name of local documents and a placeholder when there is neither url nor file', () => {
    renderModal([
      doc(1, { url: undefined, local_file_path: 'C:\\docs\\edital.pdf' }),
      doc(2, { url: undefined, local_file_path: '/home/u/modelo.pdf' }),
      doc(3, { url: undefined }),
    ]);

    expect(screen.getByText('edital.pdf')).toBeInTheDocument();
    expect(screen.getByText('modelo.pdf')).toBeInTheDocument();
    expect(screen.getByText('Documento anexado')).toBeInTheDocument();
  });

  it('suggests existing categories without duplicates', () => {
    renderModal([doc(1, { category: 'A ' }), doc(2, { category: 'A' }), doc(3, { category: ' ' })]);

    const options = Array.from(document.querySelectorAll('#quick-access-categories option')).map((o) =>
      o.getAttribute('value'),
    );
    expect(options).toEqual(['A']);
  });
});

describe('ManageQuickAccessModal PDF attachment', () => {
  it('attaches a PDF, disables the url and allows removing it', async () => {
    service.openPdfDialog.mockResolvedValue('C:\\files\\edital.pdf');
    renderModal([]);

    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));

    expect(await screen.findByText('edital.pdf', { exact: false })).toBeInTheDocument();
    expect(urlInput()).toBeDisabled();
    expect(screen.getByRole('button', { name: /Trocar PDF/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remover PDF'));
    expect(screen.queryByText(/Arquivo selecionado/)).not.toBeInTheDocument();
    expect(urlInput()).toBeEnabled();
  });

  it('keeps the form unchanged when the dialog is cancelled', async () => {
    service.openPdfDialog.mockResolvedValue(null);
    renderModal([]);

    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));

    await waitFor(() => expect(service.openPdfDialog).toHaveBeenCalled());
    expect(screen.queryByText(/Arquivo selecionado/)).not.toBeInTheDocument();
  });

  it('alerts when the dialog fails', async () => {
    service.openPdfDialog.mockRejectedValue(new Error('no dialog'));
    renderModal([]);

    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao selecionar o arquivo PDF'));
  });

  it('disables attaching while a url is typed', () => {
    renderModal([]);

    fireEvent.change(urlInput(), { target: { value: 'https://x' } });

    expect(screen.getByRole('button', { name: /Anexar PDF/ })).toBeDisabled();
  });

  it('creates a document from a PDF with null url and category', async () => {
    service.openPdfDialog.mockResolvedValue('/f/a.pdf');
    renderModal([]);
    fireEvent.change(titleInput(), { target: { value: '  Edital  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));
    await screen.findByText(/Arquivo selecionado/);

    fireEvent.submit(form());

    await waitFor(() =>
      expect(service.createProjectDocument).toHaveBeenCalledWith(10, 'Edital', null, '/f/a.pdf', null),
    );
    expect(onDocumentsChanged).toHaveBeenCalled();
    expect(titleInput()).toHaveValue('');
  });
});

describe('ManageQuickAccessModal submit validation', () => {
  it('disables submit without a url or file', () => {
    renderModal([]);

    fireEvent.change(titleInput(), { target: { value: 'T' } });

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('requires a non-blank title', () => {
    renderModal([]);
    fireEvent.change(titleInput(), { target: { value: '   ' } });
    fireEvent.change(urlInput(), { target: { value: 'https://x' } });

    fireEvent.submit(form());

    expect(window.alert).toHaveBeenCalledWith('O título é obrigatório.');
    expect(service.createProjectDocument).not.toHaveBeenCalled();
  });

  it('rejects a document that has both a url and a file', () => {
    renderModal([doc(1, { local_file_path: '/f/a.pdf' })]);
    fireEvent.click(screen.getByTitle('Editar item'));

    fireEvent.submit(form());

    expect(window.alert).toHaveBeenCalledWith('Por favor, escolha apenas um: Link (URL) ou Arquivo PDF.');
    expect(service.updateProjectDocument).not.toHaveBeenCalled();
  });

  it('alerts with the error message when saving fails and keeps the form', async () => {
    service.createProjectDocument.mockRejectedValue(new Error('disk full'));
    renderModal([]);
    fireEvent.change(titleInput(), { target: { value: 'T' } });
    fireEvent.change(urlInput(), { target: { value: 'https://x' } });

    fireEvent.submit(form());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao salvar documento: disk full'));
    expect(titleInput()).toHaveValue('T');
    expect(onDocumentsChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled();
  });
});

describe('ManageQuickAccessModal editing and deleting', () => {
  it('cancels editing back to an empty "add" form', () => {
    renderModal([doc(1, { category: 'C' })]);
    fireEvent.click(screen.getByTitle('Editar item'));
    expect(titleInput()).toHaveValue('Doc 1');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Edição' }));

    expect(screen.getByText('Adicionar Novo')).toBeInTheDocument();
    expect(titleInput()).toHaveValue('');
    expect(urlInput()).toHaveValue('');
  });

  it('does nothing when deletion is not confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderModal([doc(1)]);

    fireEvent.click(screen.getByTitle('Remover item'));

    expect(service.deleteProjectDocument).not.toHaveBeenCalled();
  });

  it('deletes the item being edited and resets the form', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderModal([doc(1), doc(2)]);
    fireEvent.click(screen.getAllByTitle('Editar item')[1]);

    fireEvent.click(screen.getAllByTitle('Remover item')[1]);

    await waitFor(() => expect(onDocumentsChanged).toHaveBeenCalled());
    expect(service.deleteProjectDocument).toHaveBeenCalledWith(2);
    expect(screen.getByText('Adicionar Novo')).toBeInTheDocument();
  });

  it('keeps editing another item when deleting a different one', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderModal([doc(1), doc(2)]);
    fireEvent.click(screen.getAllByTitle('Editar item')[0]);

    fireEvent.click(screen.getAllByTitle('Remover item')[1]);

    await waitFor(() => expect(onDocumentsChanged).toHaveBeenCalled());
    expect(titleInput()).toHaveValue('Doc 1');
  });

  it('alerts when deletion fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    service.deleteProjectDocument.mockRejectedValue(new Error('locked'));
    renderModal([doc(1)]);

    fireEvent.click(screen.getByTitle('Remover item'));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao remover documento: locked'));
    expect(onDocumentsChanged).not.toHaveBeenCalled();
  });
});

describe('ManageQuickAccessModal reordering', () => {
  const three = () => [doc(1), doc(2), doc(3)];
  // jsdom has no DragEvent, so drag events carry no clientY and count as the row's lower half.
  // Rects are all zero (midpoint y=0), so a pointer at y=-1 is in the upper half.
  const hoverUpperHalf = (row: HTMLElement) => {
    const event = createEvent.dragOver(row);
    Object.defineProperty(event, 'clientY', { value: -1 });
    fireEvent(row, event);
  };

  it('uses the index carried by dataTransfer and marks the drag', () => {
    renderModal(three());
    const dataTransfer = new FakeDataTransfer();

    fireEvent.dragStart(rows()[0], { dataTransfer });

    expect(dataTransfer.getData('text/plain')).toBe('0');
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(rows()[0].style.opacity).toBe('0.35');
  });

  it('shows a gap before the hovered upper half and drops there', async () => {
    renderModal(three());
    fireEvent.dragStart(rows()[0]);
    hoverUpperHalf(rows()[2]);

    expect(gaps()).toHaveLength(1);
    fireEvent.dragOver(gaps()[0]);
    fireEvent.drop(gaps()[0]);

    await waitFor(() => expect(service.reorderProjectDocuments).toHaveBeenCalledWith(10, [2, 1, 3]));
    expect(gaps()).toHaveLength(0);
  });

  it('shows a gap after the last item and drops at the end', async () => {
    renderModal(three());
    fireEvent.dragStart(rows()[0]);
    fireEvent.dragOver(rows()[2]);

    fireEvent.dragOver(gaps()[0]);
    fireEvent.drop(gaps()[0]);

    await waitFor(() => expect(service.reorderProjectDocuments).toHaveBeenCalledWith(10, [2, 3, 1]));
  });

  it('ignores a drop back onto the same position', () => {
    renderModal(three());
    fireEvent.dragStart(rows()[1]);
    hoverUpperHalf(rows()[1]);

    fireEvent.drop(rows()[1]);

    expect(service.reorderProjectDocuments).not.toHaveBeenCalled();
  });

  it('ignores a drop without a hovered position', () => {
    renderModal(three());
    fireEvent.dragStart(rows()[0]);

    fireEvent.drop(rows()[2]);

    expect(service.reorderProjectDocuments).not.toHaveBeenCalled();
  });

  it('clears the drag state when the drag ends', () => {
    renderModal(three());
    fireEvent.dragStart(rows()[0]);
    fireEvent.dragOver(rows()[2]);

    fireEvent.dragEnd(rows()[0]);

    expect(gaps()).toHaveLength(0);
    expect(rows()[0].style.opacity).toBe('1');
  });

  it('restores the original order when saving the new order fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.reorderProjectDocuments.mockRejectedValue(new Error('db'));
    renderModal(three());
    fireEvent.dragStart(rows()[0]);
    fireEvent.dragOver(rows()[2]);

    fireEvent.drop(rows()[2]);

    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Erro ao reordenar documentos:', expect.any(Error)));
    expect(rowTitles()).toEqual(['Doc 1', 'Doc 2', 'Doc 3']);
    expect(onDocumentsChanged).not.toHaveBeenCalled();
  });
});
