import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManualArticleModal } from '../modals/ManualArticleModal';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {}
}));

describe('ManualArticleModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ManualArticleModal isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders inputs and registers typed values', () => {
    render(<ManualArticleModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('Adicionar Artigo Avulso')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText('Ex: A New Approach to Bibliometrics');
    const authorsInput = screen.getByPlaceholderText('Ex: John Doe, Jane Smith');
    const yearInput = screen.getByPlaceholderText('Ex: 2026');
    const doiInput = screen.getByPlaceholderText('Ex: 10.1000/xyz123');
    const journalInput = screen.getByPlaceholderText('Ex: Nature');
    const abstractInput = screen.getByPlaceholderText('Resumo do artigo...');

    fireEvent.change(titleInput, { target: { value: 'Manual Test Title' } });
    fireEvent.change(authorsInput, { target: { value: 'Jane Doe' } });
    fireEvent.change(yearInput, { target: { value: '2026' } });
    fireEvent.change(doiInput, { target: { value: '10.1234/test' } });
    fireEvent.change(journalInput, { target: { value: 'Science Journal' } });
    fireEvent.change(abstractInput, { target: { value: 'Some abstract content' } });

    expect(titleInput).toHaveValue('Manual Test Title');
    expect(authorsInput).toHaveValue('Jane Doe');
    expect(yearInput).toHaveValue(2026);
    expect(doiInput).toHaveValue('10.1234/test');
    expect(journalInput).toHaveValue('Science Journal');
    expect(abstractInput).toHaveValue('Some abstract content');
  });

  it('alerts if title is missing on submit', async () => {
    const onSubmit = vi.fn();
    render(<ManualArticleModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    const form = screen.getByText('Salvar Artigo').closest('form');
    fireEvent.submit(form!);

    expect(window.alert).toHaveBeenCalledWith('O título é obrigatório.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with form values when submitted successfully', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ManualArticleModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    const titleInput = screen.getByPlaceholderText('Ex: A New Approach to Bibliometrics');
    fireEvent.change(titleInput, { target: { value: 'Manual Test Title' } });

    const form = screen.getByText('Salvar Artigo').closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          title: 'Manual Test Title',
          authors: '',
          year: undefined,
          doi: undefined,
          journal: undefined,
          abstract: undefined,
        },
        undefined,
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('allows selecting and removing a PDF file', async () => {
    fakeService.openPdfDialog.mockResolvedValue('C:\\path\\to\\file.pdf');

    render(<ManualArticleModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const selectPdfBtn = screen.getByText('Selecionar PDF');
    fireEvent.click(selectPdfBtn);

    await waitFor(() => {
      expect(fakeService.openPdfDialog).toHaveBeenCalled();
      expect(screen.getByText('file.pdf')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('Remover PDF');
    fireEvent.click(removeBtn);

    expect(screen.queryByText('file.pdf')).toBeNull();
  });
});
