import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionSetCatalog from '../ai/QuestionSetCatalog';
import { projectService } from '../../services/api';

vi.mock('../../services/api', () => ({
  projectService: {
    getQuestionSets: vi.fn(),
    createQuestionSet: vi.fn(),
    deleteQuestionSet: vi.fn(),
    duplicateQuestionSet: vi.fn(),
  },
}));

describe('QuestionSetCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then lists sets', async () => {
    (projectService.getQuestionSets as any).mockResolvedValue([
      { id: 1, name: 'Metodologia', description: 'desc', questions: '["A?", "B?"]', project_id: null },
    ]);

    render(<QuestionSetCatalog projectId={1} onSelectSet={() => {}} />);

    expect(screen.getByText('Carregando conjuntos...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Metodologia')).toBeInTheDocument();
    });
    expect(screen.getByText(/Global/i)).toBeInTheDocument();
  });

  it('allows clicking to select a set', async () => {
    const onSelectMock = vi.fn();
    (projectService.getQuestionSets as any).mockResolvedValue([
      { id: 1, name: 'Metodologia', description: 'desc', questions: '["A?", "B?"]', project_id: null },
    ]);

    render(<QuestionSetCatalog projectId={1} onSelectSet={onSelectMock} />);

    await waitFor(() => {
      expect(screen.getByText('Metodologia')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Usar'));
    expect(onSelectMock).toHaveBeenCalledWith(['A?', 'B?']);
  });

  it('renders an empty state if no sets exist', async () => {
    (projectService.getQuestionSets as any).mockResolvedValue([]);

    render(<QuestionSetCatalog projectId={1} onSelectSet={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum conjunto de perguntas encontrado/i)).toBeInTheDocument();
    });
  });
});
