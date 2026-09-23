import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  AIExtractionModal,
  type AIExtractionModalProps,
  type InvestigationHistoryRecord,
} from '../modals/AIExtractionModal';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { Article, InvestigationResult, RAGExtractionResult } from '../../types';

const article = (id: number): Article => ({ id, project_id: 3, title: `Article ${id}`, status: 'read' }) as Article;

let service: FakeProjectService;
let props: AIExtractionModalProps;

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}|${JSON.stringify(location.state)}`}</div>;
};

const renderModal = (overrides: Partial<AIExtractionModalProps> = {}) => {
  props = { ...props, ...overrides };
  return render(
    <ServicesProvider apiService={service}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
        <AIExtractionModal {...props} />
      </MemoryRouter>
    </ServicesProvider>,
  );
};

const historyRecord = (overrides: Partial<InvestigationHistoryRecord> = {}): InvestigationHistoryRecord => ({
  id: 5,
  created_at: '2026-06-03T12:00:00.000Z',
  questions: JSON.stringify(['Q1']),
  articles_ids: JSON.stringify([1]),
  ...overrides,
});

beforeEach(() => {
  service = FakeProjectService.create();
  service.getQuestionSets.mockResolvedValue([]);
  props = {
    isOpen: true,
    onClose: vi.fn(),
    articlesWithPdf: [article(1), article(2)],
    articles: [article(1), article(2)],
    aiQuestions: ['Q1', 'Q2'],
    setAiQuestions: vi.fn(),
    handleMassiveExtraction: vi.fn(),
    isExtracting: false,
    extractionProgress: { current: 0, total: 0 },
    aiExtractionResults: [],
    cancelExtractionRef: { current: false },
    investigationHistory: [],
    getInvestigationResults: vi.fn().mockResolvedValue([]),
  };
});

describe('AIExtractionModal question editing', () => {
  it('removes a question', () => {
    renderModal();

    fireEvent.click(screen.getByDisplayValue('Q1').nextElementSibling as HTMLElement);

    expect(props.setAiQuestions).toHaveBeenCalledWith(['Q2']);
  });

  it('keeps one empty question when the last one is removed', () => {
    renderModal({ aiQuestions: ['Only'] });

    fireEvent.click(screen.getByDisplayValue('Only').nextElementSibling as HTMLElement);

    expect(props.setAiQuestions).toHaveBeenCalledWith(['']);
  });

  it('only allows saving the questions as a set when one is filled', () => {
    renderModal({ aiQuestions: [' '] });

    expect(screen.getByRole('button', { name: '+ Salvar Atual' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Salvar Atual' })).toHaveAttribute(
      'title',
      'Adicione perguntas acima para salvar',
    );
  });

  it('opens and cancels the new question set form', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '+ Salvar Atual' }));
    await screen.findByPlaceholderText('Nome do conjunto');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByPlaceholderText('Nome do conjunto')).not.toBeInTheDocument());
  });

  it('explains when no article has a PDF', () => {
    renderModal({ articlesWithPdf: [] });

    expect(screen.getByText('Nenhum artigo com PDF vinculado encontrado neste projeto.')).toBeInTheDocument();
  });
});

describe('AIExtractionModal running and results', () => {
  it('lets the user cancel a running extraction and blocks closing', () => {
    renderModal({ isExtracting: true, extractionProgress: { current: 1, total: 4 } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.cancelExtractionRef.current).toBe(true);
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    expect(screen.getByText('Processando artigo 1 de 4...')).toBeInTheDocument();
  });

  it('lists only the filled questions once finished and closes on "Concluir"', () => {
    renderModal({ aiQuestions: ['Q1', ' '], aiExtractionResults: [{ article: article(1), error: 'Sem texto' }] });

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Q1']);
    expect(screen.getByText('Sem texto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir Investigação' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('opens the reader on the evidence page and closes', () => {
    const result: RAGExtractionResult = {
      question: 'Q1',
      synthesizedAnswer: 'A',
      confidenceScore: 0.9,
      evidences: [{ text: 'quote', page: 4, bbox: null, reasoning: 'r' }],
    };
    renderModal({
      aiExtractionResults: [{ article: article(2), result: [result] }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Visualizar no Documento' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/reader/2|{"searchQuery":"quote","page":4}');
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('AIExtractionModal history', () => {
  const openHistory = () => fireEvent.click(screen.getByText('Histórico'));

  it('shows an empty history message', () => {
    renderModal();
    openHistory();

    expect(screen.getByText('Nenhum histórico encontrado.')).toBeInTheDocument();
  });

  it('names unknown articles by id and colors failed runs', () => {
    renderModal({ investigationHistory: [historyRecord({ articles_ids: '[1, 9]', status: 'Falha' })] });
    openHistory();

    expect(screen.getByText('Article 1 • Artigo #9')).toBeInTheDocument();
    expect(screen.getByText('2 Artigos')).toBeInTheDocument();
    expect(screen.getByText('Falha').style.background).toBe('var(--color-danger)');
  });

  it('treats malformed stored questions or article ids as empty', () => {
    renderModal({ investigationHistory: [historyRecord({ questions: '{bad', articles_ids: 'nope' })] });
    openHistory();

    expect(screen.getByText('0 Artigos')).toBeInTheDocument();
  });

  it('goes back from the details to the list', async () => {
    renderModal({ investigationHistory: [historyRecord()] });
    openHistory();
    fireEvent.click(screen.getByText('Ver Detalhes'));

    fireEvent.click(await screen.findByText(/Voltar ao Histórico/));

    expect(screen.getByText('Ver Detalhes')).toBeInTheDocument();
  });

  it('re-executes an investigation in the new tab with its questions and articles', async () => {
    const results = [{ article_id: 2, question: 'Q1', status: 'success' }] as InvestigationResult[];
    renderModal({
      investigationHistory: [historyRecord()],
      getInvestigationResults: vi.fn().mockResolvedValue(results),
    });
    openHistory();
    fireEvent.click(screen.getByText('Ver Detalhes'));

    fireEvent.click(await screen.findByRole('button', { name: 'Re-executar' }));

    expect(props.setAiQuestions).toHaveBeenCalledWith(['Q1']);
    expect(screen.getByRole('button', { name: 'Iniciar Investigação' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Investigação' }));
    expect(props.handleMassiveExtraction).toHaveBeenCalledWith([2]);
  });

  it('leaves the details when switching back to the new investigation tab', async () => {
    renderModal({ investigationHistory: [historyRecord()] });
    openHistory();
    fireEvent.click(screen.getByText('Ver Detalhes'));
    await screen.findByText(/Voltar ao Histórico/);

    fireEvent.click(screen.getByText('Nova Investigação'));
    openHistory();

    expect(within(document.body).getByText('Ver Detalhes')).toBeInTheDocument();
  });
});
