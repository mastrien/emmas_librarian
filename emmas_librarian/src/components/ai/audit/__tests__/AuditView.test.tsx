import { act } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AuditView, type AuditViewProps } from '../AuditView';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import type { Article, InvestigationAudit, InvestigationResult } from '../../../../types';

const rag = (answer: string, quote: string) =>
  JSON.stringify({
    question: 'Q',
    synthesizedAnswer: answer,
    confidenceScore: 0.9,
    evidences: [{ text: quote, page: 4, bbox: null, reasoning: '' }],
  });

function result(id: number, question: string, overrides: Partial<InvestigationResult> = {}): InvestigationResult {
  return {
    id,
    investigation_id: 19,
    article_id: id,
    question,
    answer: rag(`Resposta ${id}`, `Trecho citado ${id}`),
    quote: null,
    status: 'success',
    error_message: null,
    created_at: '',
    review_status: 'pending',
    reviewed_answer: null,
    reviewed_at: null,
    ...overrides,
  };
}

const QUESTIONS = ['Qual o desenho?', 'Qual a base?', 'Há conflito de interesses?'];
const results = [
  result(1, 'Qual o desenho?'),
  result(2, 'Qual o desenho?', { answer: 'Texto antigo', quote: null }),
  result(3, 'Qual a base?'),
  result(4, 'Há conflito de interesses?', { status: 'error', answer: null }),
];
const articles = results.map((r) => ({
  id: r.article_id,
  title: `Estudo ${r.id}`,
  status: 'new',
  project_id: 1,
})) as Article[];
const fullDraw: InvestigationAudit = {
  id: 1,
  investigation_id: 19,
  seed: 7,
  sample_percent: 100,
  min_per_question: 1,
  created_at: '',
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="reader">{JSON.stringify(location.state)}</div>;
};

function renderAudit(audit: InvestigationAudit | null, overrides: Partial<AuditViewProps> = {}) {
  const service = new FakeProjectService();
  service.getInvestigationAudit.mockResolvedValue(audit);
  const onReview = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter initialEntries={['/projects/1']}>
      <ServicesProvider apiService={service}>
        <Routes>
          <Route
            path="/projects/1"
            element={
              <AuditView
                investigation={{
                  id: 19,
                  created_at: '',
                  model_used: 'Gemini 2.5 Flash',
                  questions: JSON.stringify(QUESTIONS),
                }}
                projectId={1}
                articles={articles}
                results={results}
                history={[{ id: 19, created_at: '', model_used: 'Gemini 2.5 Flash' }]}
                getInvestigationResults={async () => results}
                onReview={onReview}
                onBack={vi.fn()}
                {...overrides}
              />
            }
          />
          <Route path="/articles/:id" element={<LocationProbe />} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
  return { service, onReview };
}

async function openFirstItem() {
  fireEvent.click(await screen.findByText('Qual o desenho?'));
  fireEvent.click(screen.getByRole('button', { name: /Estudo 1/ }));
}

describe('AuditView (#48)', () => {
  it('draws a sample with a fresh seed when there is no audit yet', async () => {
    const { service } = renderAudit(null);

    // Wait outside act: act holds state updates until it ends, so the loading screen would never go away.
    const drawButton = await screen.findByRole('button', { name: 'Sortear amostra' });
    await act(async () => {
      fireEvent.click(drawButton);
    });

    const [investigationId, params] = service.saveInvestigationAudit.mock.calls[0];
    expect(investigationId).toBe(19);
    expect(params).toMatchObject({ samplePercent: 10, minPerQuestion: 2 });
    expect(Number.isInteger(params.seed) && params.seed > 0).toBe(true);
    expect(await screen.findByText(/de 3 marcados/)).toBeInTheDocument();
  });

  it('lists questions with what came back, and says when a question has nothing to audit', async () => {
    renderAudit(fullDraw);

    const row = (await screen.findByText('Há conflito de interesses?')).closest('tr')!;
    expect(within(row).getByText('nada a auditar')).toBeInTheDocument();
    expect(within(row).getByText('+1 com erro')).toBeInTheDocument();
  });

  it('shows the selected answer and what the AI cited, and marks it from the panel', async () => {
    const { onReview } = renderAudit(fullDraw);
    await openFirstItem();

    const panel = screen.getByRole('complementary', { name: 'Evidência do item selecionado' });
    expect(within(panel).getByText('Resposta 1')).toBeInTheDocument();
    expect(within(panel).getByText('Trecho citado 1')).toBeInTheDocument();
    expect(within(panel).getByText(/página 4/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Correto/ }));

    expect(onReview).toHaveBeenCalledWith(1, { status: 'accepted' });
  });

  it('warns when an answer cites nothing', async () => {
    renderAudit(fullDraw);
    fireEvent.click(await screen.findByText('Qual o desenho?'));
    fireEvent.click(screen.getByRole('button', { name: /Estudo 2/ }));

    expect(screen.getByText(/A IA não citou nenhum trecho/)).toBeInTheDocument();
  });

  it('marks with the keys R and opens the fix box with E, but not while typing', async () => {
    const { onReview } = renderAudit(fullDraw);
    await openFirstItem();

    fireEvent.keyDown(window, { key: 'r' });
    expect(onReview).toHaveBeenCalledWith(1, { status: 'rejected' });

    fireEvent.keyDown(window, { key: 'e' });
    const box = screen.getByLabelText('Resposta corrigida');
    fireEvent.keyDown(box, { key: 'a' });
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('opens the PDF on the evidence and remembers the item to come back to', async () => {
    renderAudit(fullDraw);
    await openFirstItem();

    fireEvent.click(screen.getByRole('button', { name: /Abrir no PDF/ }));

    expect(JSON.parse(screen.getByTestId('reader').textContent!)).toEqual({
      searchQuery: 'Trecho citado 1',
      page: 4,
      returnTo: { projectId: 1, investigationId: 19, resultId: 1 },
    });
  });

  it('reviews in sequence: the next pending item, its evidence beside it', async () => {
    const { onReview } = renderAudit(fullDraw);

    fireEvent.click(await screen.findByRole('button', { name: 'Revisar em sequência' }));
    const queue = screen.getByRole('region', { name: 'Revisão em sequência' });
    expect(within(queue).getByText('Trecho citado 1')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'a' });

    expect(onReview).toHaveBeenCalledWith(1, { status: 'accepted' });
  });

  it('reopens on the item it came back from the reader to', async () => {
    renderAudit(fullDraw, { initialResultId: 3 });

    const panel = await screen.findByRole('complementary', { name: 'Evidência do item selecionado' });
    expect(within(panel).getByText('Resposta 3')).toBeInTheDocument();
  });

  it('explains the estimate, the interval and the plot behind "?"', async () => {
    renderAudit(fullDraw);

    fireEvent.click(await screen.findByRole('button', { name: 'O que é o acerto estimado e o IC 95%' }));
    expect(screen.getByRole('dialog', { name: 'Como ler a auditoria' })).toHaveTextContent(
      'em 95 de cada 100 auditorias',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('asks for another audited model before comparing', async () => {
    renderAudit(fullDraw);

    expect(await screen.findByText(/Audite outra investigação deste projeto/)).toBeInTheDocument();
  });
});
