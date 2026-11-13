import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, createEvent } from '@testing-library/react';
import { ManageQuickAccessModal } from '../modals/ManageQuickAccessModal';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { ProjectDocument } from '../../types';
import { FakeDialogs, withFakeDialogs } from '../common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
const renderWithDialogs = (ui: React.ReactElement) => render(ui, { wrapper: withFakeDialogs(dialogs) });
beforeEach(() => {
  dialogs = new FakeDialogs();
});

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

const renderModal = (documents: ProjectDocument[]) => renderWithDialogs(modal(documents));
const titleInput = () => screen.getByPlaceholderText('Ex: Trello do Projeto, Edital CAPES');
const urlInput = () => screen.getByPlaceholderText('https://');
const form = () => titleInput().closest('form') as HTMLFormElement;
const rows = () => Array.from(document.querySelectorAll('[draggable]')) as HTMLElement[];
const rowTitles = () => rows().map((row) => row.querySelector('.quick-access-row__title')?.textContent);
const openAdd = () => fireEvent.click(screen.getByRole('button', { name: /Link ou arquivo/ }));
const chooseFromMenu = (title: string, action: 'Editar' | 'Remover') => {
  fireEvent.click(screen.getByRole('button', { name: `Ações de ${title}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
};
const gaps = () => screen.queryAllByTestId('quick-access-drop-gap');

beforeEach(() => {
  service = FakeProjectService.create();
  onDocumentsChanged = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ManageQuickAccessModal lifecycle', () => {
  it('can be opened after rendering closed', () => {
    const { rerender } = renderWithDialogs(modal([doc(1)], false));

    rerender(modal([doc(1)], true));

    expect(screen.getByText('Doc 1')).toBeInTheDocument();
  });

  it('closes from the X button', () => {
    const onClose = vi.fn();
    renderWithDialogs(modal([], true, onClose));

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the file name of local documents and a placeholder when there is neither url nor file', () => {
    renderModal([
      doc(1, { url: undefined, local_file_path: 'C:\\docs\\edital.pdf' }),
      doc(2, { url: undefined, local_file_path: '/home/u/modelo.pdf' }),
      doc(3, { url: undefined }),
    ]);

    expect(screen.getByText('arquivo local · edital.pdf')).toBeInTheDocument();
    expect(screen.getByText('arquivo local · modelo.pdf')).toBeInTheDocument();
    expect(screen.getByText('arquivo local · anexado')).toBeInTheDocument();
  });

  it('suggests existing categories without duplicates', () => {
    renderModal([doc(1, { category: 'A ' }), doc(2, { category: 'A' }), doc(3, { category: ' ' })]);
    openAdd();

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
    openAdd();

    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));

    expect(await screen.findByText('edital.pdf', { exact: false })).toBeInTheDocument();
    expect(urlInput()).toBeDisabled();
    expect(screen.getByRole('button', { name: /Trocar PDF/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remover PDF'));
    expect(screen.queryByText('edital.pdf', { exact: false })).not.toBeInTheDocument();
    expect(urlInput()).toBeEnabled();
  });

  it('keeps the form unchanged when the dialog is cancelled', async () => {
    service.openPdfDialog.mockResolvedValue(null);
    renderModal([]);
    openAdd();

    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));

    await waitFor(() => expect(service.openPdfDialog).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Anexar PDF/ })).toBeInTheDocument();
    expect(screen.queryByTitle('Remover PDF')).not.toBeInTheDocument();
  });

  it('alerts when the dialog fails', async () => {
    service.openPdfDialog.mockRejectedValue(new Error('no dialog'));
    renderModal([]);
    openAdd();

    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao selecionar o arquivo PDF'));
  });

  it('disables attaching while a url is typed', () => {
    renderModal([]);
    openAdd();

    fireEvent.change(urlInput(), { target: { value: 'https://x' } });

    expect(screen.getByRole('button', { name: /Anexar PDF/ })).toBeDisabled();
  });

  it('creates a document from a PDF with null url and category', async () => {
    service.openPdfDialog.mockResolvedValue('/f/a.pdf');
    renderModal([]);
    openAdd();
    fireEvent.change(titleInput(), { target: { value: '  Edital  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Anexar PDF/ }));
    await screen.findByText('a.pdf');

    fireEvent.submit(form());

    await waitFor(() =>
      expect(service.createProjectDocument).toHaveBeenCalledWith(10, 'Edital', null, '/f/a.pdf', null),
    );
    expect(onDocumentsChanged).toHaveBeenCalled();
    // Saved: back to the list, and the next new item starts empty.
    openAdd();
    expect(titleInput()).toHaveValue('');
  });
});

describe('ManageQuickAccessModal submit validation', () => {
  it('disables submit without a url or file', () => {
    renderModal([]);
    openAdd();

    fireEvent.change(titleInput(), { target: { value: 'T' } });

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('requires a non-blank title', () => {
    renderModal([]);
    openAdd();
    fireEvent.change(titleInput(), { target: { value: '   ' } });
    fireEvent.change(urlInput(), { target: { value: 'https://x' } });

    fireEvent.submit(form());

    expect(dialogs.informMessage).toHaveBeenCalledWith('O título é obrigatório.');
    expect(service.createProjectDocument).not.toHaveBeenCalled();
  });

  it('rejects a document that has both a url and a file', () => {
    renderModal([doc(1, { local_file_path: '/f/a.pdf' })]);
    chooseFromMenu('Doc 1', 'Editar');

    fireEvent.submit(form());

    expect(dialogs.informMessage).toHaveBeenCalledWith('Por favor, escolha apenas um: Link (URL) ou Arquivo PDF.');
    expect(service.updateProjectDocument).not.toHaveBeenCalled();
  });

  it('alerts with the error message when saving fails and keeps the form', async () => {
    service.createProjectDocument.mockRejectedValue(new Error('disk full'));
    renderModal([]);
    openAdd();
    fireEvent.change(titleInput(), { target: { value: 'T' } });
    fireEvent.change(urlInput(), { target: { value: 'https://x' } });

    fireEvent.submit(form());

    await waitFor(() =>
      expect(dialogs.informed).toContainEqual(
        expect.objectContaining({ message: 'O documento não foi salvo.', details: 'disk full' }),
      ),
    );
    expect(titleInput()).toHaveValue('T');
    expect(onDocumentsChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeEnabled();
  });
});

describe('ManageQuickAccessModal editing and deleting', () => {
  it('cancels editing back to the list, and the next new item starts empty', () => {
    renderModal([doc(1, { category: 'C' })]);
    chooseFromMenu('Doc 1', 'Editar');
    expect(titleInput()).toHaveValue('Doc 1');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: /Link ou arquivo/ })).toBeInTheDocument();
    openAdd();
    expect(titleInput()).toHaveValue('');
    expect(urlInput()).toHaveValue('');
  });

  it('opens "Novo grupo" with the group to fill in first', () => {
    renderModal([doc(1, { category: 'C' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));

    expect(screen.getByRole('heading', { name: 'Novo grupo' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Reuniões, Modelos')).toHaveFocus();
  });

  it('does nothing when deletion is not confirmed', async () => {
    dialogs.confirmMessage.mockReturnValue(false);
    renderModal([doc(1)]);

    chooseFromMenu('Doc 1', 'Remover');
    // The answer is a promise: check only once the question was answered, or a missing check passes.
    await waitFor(() => expect(dialogs.asked).toHaveLength(1));
    await act(async () => {});

    expect(service.deleteProjectDocument).not.toHaveBeenCalled();
  });

  it('removes the item after the question is confirmed', async () => {
    renderModal([doc(1), doc(2)]);

    chooseFromMenu('Doc 2', 'Remover');

    await waitFor(() => expect(onDocumentsChanged).toHaveBeenCalled());
    expect(service.deleteProjectDocument).toHaveBeenCalledWith(2);
  });

  it('alerts when deletion fails', async () => {
    service.deleteProjectDocument.mockRejectedValue(new Error('locked'));
    renderModal([doc(1)]);

    chooseFromMenu('Doc 1', 'Remover');

    await waitFor(() =>
      expect(dialogs.informed).toContainEqual(
        expect.objectContaining({ message: 'O documento continua no acesso rápido.', details: 'locked' }),
      ),
    );
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
    expect(rows()[0]).toHaveClass('is-dragged');
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
    expect(rows()[0]).not.toHaveClass('is-dragged');
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

describe('ManageQuickAccessModal groups', () => {
  const renameFirstGroup = (to: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Renomear grupo A' }));
    const field = screen.getByLabelText('Novo nome do grupo A');
    fireEvent.change(field, { target: { value: to } });
    fireEvent.keyDown(field, { key: 'Enter' });
  };

  it('renames a group by renaming the category of each of its documents', async () => {
    renderModal([doc(1, { category: 'A' }), doc(2, { category: 'B' }), doc(3, { category: 'A' })]);

    renameFirstGroup('Z');

    await waitFor(() => expect(onDocumentsChanged).toHaveBeenCalled());
    expect(service.updateProjectDocument).toHaveBeenCalledTimes(2);
    expect(service.updateProjectDocument).toHaveBeenCalledWith(1, 'Doc 1', 'https://d1.com', null, 'Z');
    expect(service.updateProjectDocument).toHaveBeenCalledWith(3, 'Doc 3', 'https://d3.com', null, 'Z');
  });

  it('says when a group could not be renamed', async () => {
    service.updateProjectDocument.mockRejectedValue(new Error('locked'));
    renderModal([doc(1, { category: 'A' })]);

    renameFirstGroup('Z');

    await waitFor(() =>
      expect(dialogs.informed).toContainEqual(
        expect.objectContaining({ message: 'O grupo manteve o nome.', details: 'locked' }),
      ),
    );
    expect(onDocumentsChanged).not.toHaveBeenCalled();
  });

  it('lists the documents of a group together, the ones with no group first', () => {
    renderModal([doc(1, { category: 'A' }), doc(2), doc(3, { category: 'A' })]);

    expect(rowTitles()).toEqual(['Doc 2', 'Doc 1', 'Doc 3']);
  });
});
