// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Article } from '../../types';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AIExtractionModal } from '../modals/AIExtractionModal';
import { GlobalErrorProvider } from '../../contexts/GlobalErrorContext';
import { MemoryRouter } from 'react-router-dom';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <GlobalErrorProvider>{ui}</GlobalErrorProvider>
    </MemoryRouter>,
  );
};

describe('AIExtractionModal', () => {
  const mockArticlesWithPdf = [
    { id: 1, title: 'Article 1' },
    { id: 2, title: 'Article 2' },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    articlesWithPdf: mockArticlesWithPdf,
    aiQuestions: ['What is the goal?'],
    setAiQuestions: vi.fn(),
    handleMassiveExtraction: vi.fn(),
    isExtracting: false,
    extractionProgress: { current: 0, total: 0 },
    aiExtractionResults: [],
    cancelExtractionRef: { current: false },
    investigationHistory: [],
    articles: mockArticlesWithPdf,
  };

  it('does not render when isOpen is false', () => {
    const { container } = renderWithProviders(<AIExtractionModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders tab buttons and defaults to Nova Investigação tab', () => {
    renderWithProviders(<AIExtractionModal {...defaultProps} />);
    expect(screen.getByText('Investigação Massiva com IA')).toBeInTheDocument();
    expect(screen.getByText('Nova Investigação')).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();

    // Shows articles
    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('Article 2')).toBeInTheDocument();
  });

  it('supports selecting and deselecting articles', () => {
    renderWithProviders(<AIExtractionModal {...defaultProps} />);

    // Default selection is all articles
    expect(screen.getByText('2/2')).toBeInTheDocument();

    const deselectBtn = screen.getByText('Desmarcar Todos');
    fireEvent.click(deselectBtn);
    expect(screen.getByText('0/2')).toBeInTheDocument();

    const selectAllBtn = screen.getByText('Selecionar Todos');
    fireEvent.click(selectAllBtn);
    expect(screen.getByText('2/2')).toBeInTheDocument();

    // Toggle individual checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // deselect first article
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('supports adding and removing questions', () => {
    const setAiQuestions = vi.fn();
    renderWithProviders(<AIExtractionModal {...defaultProps} setAiQuestions={setAiQuestions} />);

    // Add question
    const addBtn = screen.getByText('+ Adicionar Pergunta');
    fireEvent.click(addBtn);
    expect(setAiQuestions).toHaveBeenCalledWith(['What is the goal?', '']);

    // Remove question
    const removeBtns = screen.getAllByRole('button');
    // First remove button after XIcon, tab buttons, check toggle buttons is the delete question button
    const trashBtn = removeBtns.find((btn) => btn.innerHTML.includes('svg')); // trash icon
    if (trashBtn) {
      fireEvent.click(trashBtn);
      expect(setAiQuestions).toHaveBeenCalled();
    }
  });

  it('starts massive extraction when Start button is clicked', () => {
    const handleMassiveExtraction = vi.fn();
    renderWithProviders(<AIExtractionModal {...defaultProps} handleMassiveExtraction={handleMassiveExtraction} />);

    const startBtn = screen.getByText('Iniciar Investigação');
    fireEvent.click(startBtn);

    expect(handleMassiveExtraction).toHaveBeenCalledWith([1, 2]);
  });

  it('renders extraction progress when isExtracting is true', () => {
    renderWithProviders(
      <AIExtractionModal {...defaultProps} isExtracting={true} extractionProgress={{ current: 1, total: 2 }} />,
    );

    expect(screen.getByText('Processando artigo 1 de 2...')).toBeInTheDocument();
    expect(screen.getByText('Cancelar Investigação')).toBeInTheDocument();
  });

  it('renders results when aiExtractionResults are provided', async () => {
    const results = [
      {
        article: { id: 1, project_id: 1, status: 'new', title: 'Article 1' },
        result: [
          {
            question: 'What is the goal?',
            extracted_answer: 'To test components',
            confidenceScore: 0.9,
            evidences: [{ text: 'test quotes', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } }],
          },
        ],
      },
    ];

    renderWithProviders(<AIExtractionModal {...defaultProps} aiExtractionResults={results} />);

    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('Q: What is the goal?')).toBeInTheDocument();
    expect(screen.getByText('test quotes')).toBeInTheDocument();
  });

  it('renders history list when switching to History tab', () => {
    const history = [
      {
        created_at: '2026-06-03T12:00:00.000Z',
        questions: JSON.stringify(['How is the weather?']),
        articles_ids: JSON.stringify([1]),
        status: 'Sucesso',
        model_used: 'gemini-1.5-pro',
      },
    ];

    renderWithProviders(<AIExtractionModal {...defaultProps} investigationHistory={history} />);

    const historyTab = screen.getByText('Histórico');
    fireEvent.click(historyTab);

    expect(screen.getByText('gemini-1.5-pro')).toBeInTheDocument();
    expect(screen.getByText('Sucesso')).toBeInTheDocument();
    expect(screen.getByText('How is the weather?')).toBeInTheDocument();
    expect(screen.getByText('Article 1')).toBeInTheDocument();
  });
});
