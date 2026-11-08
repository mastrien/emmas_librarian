import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionSetCatalog from '../ai/QuestionSetCatalog';
import { projectService } from '../../services/api';
import { FakeDialogs, FakeDialogsProvider } from '../common/dialogs/__tests__/fakes/FakeDialogs';

vi.mock('../../services/api', async () => {
  const { FakeProjectService } = await import('../../services/__tests__/fakes/FakeProjectService');
  return { projectService: FakeProjectService.create() };
});

const service = vi.mocked(projectService);
const METODOLOGIA = {
  id: 1,
  name: 'Metodologia',
  description: 'desc',
  questions: '["A?", "B?"]',
  project_id: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

let dialogs = new FakeDialogs();
const renderCatalog = (props: Partial<React.ComponentProps<typeof QuestionSetCatalog>> = {}) =>
  render(
    <FakeDialogsProvider dialogs={dialogs}>
      <QuestionSetCatalog projectId={1} onSelectSet={() => {}} {...props} />
    </FakeDialogsProvider>,
  );

describe('QuestionSetCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dialogs = new FakeDialogs();
    service.getQuestionSets.mockResolvedValue([METODOLOGIA]);
  });

  it('renders loading state initially and then lists sets', async () => {
    renderCatalog();

    expect(screen.getByText('Carregando conjuntos...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Metodologia')).toBeInTheDocument();
    });
    expect(screen.getByText(/Global/i)).toBeInTheDocument();
    expect(screen.getByText(/2 perguntas/)).toBeInTheDocument();
  });

  it('allows clicking to select a set', async () => {
    const onSelectMock = vi.fn();
    renderCatalog({ onSelectSet: onSelectMock });

    fireEvent.click(await screen.findByText('Usar'));
    expect(onSelectMock).toHaveBeenCalledWith(['A?', 'B?']);
  });

  it('renders an empty state if no sets exist', async () => {
    service.getQuestionSets.mockResolvedValue([]);

    renderCatalog();

    await waitFor(() => {
      expect(screen.getByText(/Nenhum conjunto de perguntas encontrado/i)).toBeInTheDocument();
    });
  });

  it('saves the filled current questions as a global set and closes the form', async () => {
    renderCatalog({ currentQuestions: ['A?', '  '] });

    fireEvent.click(await screen.findByText('+ Salvar Atual'));
    fireEvent.change(screen.getByPlaceholderText('Nome do conjunto'), { target: { value: ' Novo ' } });
    fireEvent.click(screen.getByLabelText(/Global/));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByPlaceholderText('Nome do conjunto')).not.toBeInTheDocument());
    expect(service.createQuestionSet).toHaveBeenCalledWith({
      project_id: null,
      name: 'Novo',
      description: null,
      questions: '["A?"]',
    });
  });

  it('renames a set in place', async () => {
    renderCatalog();

    fireEvent.click(await screen.findByTitle('Editar'));
    fireEvent.change(screen.getByDisplayValue('Metodologia'), { target: { value: 'Método' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(service.updateQuestionSet).toHaveBeenCalledWith(1, { name: 'Método', description: 'desc' }),
    );
  });

  it('duplicates into this project and deletes only after the app asks', async () => {
    renderCatalog();

    fireEvent.click(await screen.findByTitle('Duplicar'));
    await waitFor(() => expect(service.duplicateQuestionSet).toHaveBeenCalledWith(1, 1));

    dialogs.confirmMessage.mockReturnValueOnce(false);
    fireEvent.click(screen.getByTitle('Excluir'));
    await waitFor(() => expect(dialogs.asked).toHaveLength(1));
    expect(service.deleteQuestionSet).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Excluir'));
    await waitFor(() => expect(service.deleteQuestionSet).toHaveBeenCalledWith(1));
    expect(dialogs.asked[1]).toMatchObject({ title: 'Excluir conjunto', danger: true });
  });

  it('tells a failure in the app window and keeps the form open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.createQuestionSet.mockRejectedValue(new Error('disk full'));
    renderCatalog({ currentQuestions: ['A?'] });

    fireEvent.click(await screen.findByText('+ Salvar Atual'));
    fireEvent.change(screen.getByPlaceholderText('Nome do conjunto'), { target: { value: 'Novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao criar conjunto de perguntas.'));
    expect(screen.getByPlaceholderText('Nome do conjunto')).toBeInTheDocument();
  });
});
