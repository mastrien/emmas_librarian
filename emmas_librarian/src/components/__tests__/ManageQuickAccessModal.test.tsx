import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManageQuickAccessModal } from '../modals/ManageQuickAccessModal';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { ProjectDocument } from '../../types';

describe('ManageQuickAccessModal', () => {
  let fakeService: FakeProjectService;

  const mockDocuments: ProjectDocument[] = [
    {
      id: 1,
      project_id: 10,
      title: 'Trello do Projeto',
      url: 'https://trello.com/board',
      created_at: '2026-07-22',
      position: 0,
      category: 'Ferramentas',
    },
    {
      id: 2,
      project_id: 10,
      title: 'Link da Reunião',
      url: 'https://meet.google.com/abc',
      created_at: '2026-07-22',
      position: 1,
      category: 'Reuniões',
    },
  ];

  beforeEach(() => {
    fakeService = FakeProjectService.create();
  });

  const renderModal = (props: {
    isOpen: boolean;
    documents?: ProjectDocument[];
    onClose?: () => void;
    onDocumentsChanged?: () => void;
  }) => {
    return render(
      <ServicesProvider apiService={fakeService}>
        <ManageQuickAccessModal
          isOpen={props.isOpen}
          onClose={props.onClose || vi.fn()}
          projectId={10}
          documents={props.documents || []}
          onDocumentsChanged={props.onDocumentsChanged || vi.fn()}
        />
      </ServicesProvider>,
    );
  };

  it('renders null when isOpen is false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.innerHTML).toBe('');
  });

  it('renders empty message when no documents are provided', () => {
    renderModal({ isOpen: true, documents: [] });
    expect(screen.getByText('Nenhum link ou documento cadastrado.')).toBeInTheDocument();
  });

  it('renders existing documents and their categories', () => {
    renderModal({ isOpen: true, documents: mockDocuments });
    expect(screen.getByText('Trello do Projeto')).toBeInTheDocument();
    expect(screen.getByText('Link da Reunião')).toBeInTheDocument();
    expect(screen.getByText('Ferramentas')).toBeInTheDocument();
    expect(screen.getByText('Reuniões')).toBeInTheDocument();
  });

  it('allows creating a new document with category', async () => {
    const onDocsChangedMock = vi.fn();
    renderModal({ isOpen: true, documents: [], onDocumentsChanged: onDocsChangedMock });

    const titleInput = screen.getByPlaceholderText('Ex: Trello do Projeto, Edital CAPES');
    const categoryInput = screen.getByPlaceholderText('Ex: Reuniões, Modelos');
    const urlInput = screen.getByPlaceholderText('https://');

    fireEvent.change(titleInput, { target: { value: 'Novo Atalho' } });
    fireEvent.change(categoryInput, { target: { value: 'Manuais' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

    const submitBtn = screen.getByRole('button', { name: /adicionar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fakeService.createProjectDocument).toHaveBeenCalledWith(
        10,
        'Novo Atalho',
        'https://example.com',
        null,
        'Manuais',
      );
      expect(onDocsChangedMock).toHaveBeenCalled();
    });
  });

  it('switches to edit mode when clicking edit button and updates document', async () => {
    const onDocsChangedMock = vi.fn();
    renderModal({ isOpen: true, documents: mockDocuments, onDocumentsChanged: onDocsChangedMock });

    const editButtons = screen.getAllByTitle('Editar item');
    fireEvent.click(editButtons[0]); // Edit first item

    expect(screen.getByText('Editar Acesso Rápido')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Trello do Projeto')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue('Trello do Projeto');
    fireEvent.change(titleInput, { target: { value: 'Trello Editado' } });

    const submitBtn = screen.getByRole('button', { name: /salvar alterações/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fakeService.updateProjectDocument).toHaveBeenCalledWith(
        1,
        'Trello Editado',
        'https://trello.com/board',
        null,
        'Ferramentas',
      );
      expect(onDocsChangedMock).toHaveBeenCalled();
    });
  });

  it('handles drag and drop reordering', async () => {
    const onDocsChangedMock = vi.fn();
    renderModal({ isOpen: true, documents: mockDocuments, onDocumentsChanged: onDocsChangedMock });

    const items = screen.getAllByTitle('Segure para arrastar e reordenar');
    expect(items).toHaveLength(2);

    const firstDraggable = items[0].closest('[draggable]')!;
    const secondDraggable = items[1].closest('[draggable]')!;

    fireEvent.dragStart(firstDraggable);
    fireEvent.dragOver(secondDraggable);
    fireEvent.drop(secondDraggable);

    await waitFor(() => {
      expect(fakeService.reorderProjectDocuments).toHaveBeenCalledWith(10, [2, 1]);
      expect(onDocsChangedMock).toHaveBeenCalled();
    });
  });
});
