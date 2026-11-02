import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { InvestigationDetailView } from '../InvestigationDetailView';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type { Article, InvestigationResult } from '../../../types';

const articles = [
  { id: 1, title: 'Estudo A', status: 'new', project_id: 1 },
  { id: 2, title: 'Estudo B', status: 'new', project_id: 1 },
] as Article[];

const result = (id: number, articleId: number, overrides: Partial<InvestigationResult> = {}): InvestigationResult => ({
  id,
  investigation_id: 9,
  article_id: articleId,
  question: `Pergunta ${id}`,
  answer: `Resposta ${id}`,
  quote: null,
  status: 'success',
  error_message: null,
  created_at: '2026-10-18',
  review_status: 'pending',
  reviewed_answer: null,
  reviewed_at: null,
  ...overrides,
});

const results = [
  result(1, 1),
  result(2, 2, { review_status: 'accepted' }),
  result(3, 2, { status: 'error', answer: null, error_message: 'sem texto' }),
];

function renderView(service = new FakeProjectService()) {
  render(
    <MemoryRouter>
      <ServicesProvider apiService={service}>
        <InvestigationDetailView
          investigation={{
            id: 9,
            created_at: '2026-10-18',
            status: 'Sucesso',
            model_used: 'gpt-x',
            questions: '[]',
            articles_ids: '[1,2]',
          }}
          articles={articles}
          getInvestigationResults={async () => results}
          onBack={vi.fn()}
          onReExecute={vi.fn()}
        />
      </ServicesProvider>
    </MemoryRouter>,
  );
  return service;
}

describe('InvestigationDetailView, reviewing AI answers (#47)', () => {
  it('counts only answers that came back and nobody reviewed, and can show just those', async () => {
    renderView();
    const filter = await screen.findByLabelText('Só pendentes de revisão (1)');

    fireEvent.click(filter);

    expect(screen.getByText(/Estudo A/)).toBeInTheDocument();
    expect(screen.queryByText(/Estudo B/)).toBeNull();
  });

  it('says so when no answer is left to review', async () => {
    renderView();
    await screen.findByText(/Estudo A/);
    fireEvent.click(screen.getByText(/Estudo A/));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    });
    fireEvent.click(screen.getByLabelText('Só pendentes de revisão (0)'));

    expect(screen.getByText('Nenhuma resposta pendente de revisão.')).toBeInTheDocument();
  });

  it('saves the decision and shows the row the database answered', async () => {
    const service = new FakeProjectService();
    service.reviewInvestigationResult.mockImplementation(async (id, review) => ({
      ...result(id, 1),
      review_status: review.status,
    }));
    renderView(service);
    await screen.findByText(/Estudo A/);
    fireEvent.click(screen.getByText(/Estudo A/));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rejeitar' }));
    });

    expect(service.reviewInvestigationResult).toHaveBeenCalledWith(1, { status: 'rejected' });
    await waitFor(() => expect(screen.getByText('Revisão: rejeitada')).toBeInTheDocument());
  });

  it('offers no review on an answer that failed', async () => {
    renderView();
    await screen.findByText(/Estudo B/);
    fireEvent.click(screen.getByText(/Estudo B/));

    expect(screen.getByText(/sem texto/)).toBeInTheDocument();
    // Only the answer that succeeded has a review block; the failed one offers none.
    expect(screen.getAllByLabelText(/Revisão da resposta/)).toHaveLength(1);
  });
});
