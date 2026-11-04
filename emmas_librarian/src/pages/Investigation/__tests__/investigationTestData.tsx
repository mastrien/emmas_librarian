import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { GlobalErrorProvider } from '../../../contexts/GlobalErrorContext';
import { InvestigationRunProvider } from '../../../contexts/InvestigationRunContext';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type { Article, InvestigationHistoryRecord, InvestigationResult, MassiveInvestigation } from '../../../types';
import { InvestigationPage } from '../InvestigationPage';

export const article = (id: number, title = `Estudo ${id}`): Article =>
  ({ id, project_id: 3, title, status: 'read', local_file_path: `/pdf/${id}.pdf` }) as Article;

let nextResultId = 100;

export const answer = (
  articleId: number,
  question: string,
  extra: Partial<InvestigationResult> = {},
): InvestigationResult => ({
  id: nextResultId++,
  investigation_id: 14,
  article_id: articleId,
  question,
  answer: JSON.stringify({
    question,
    synthesizedAnswer: `Resposta de ${articleId} a ${question}`,
    confidenceScore: 0.9,
    evidences: [{ text: 'trecho citado', page: 4 }],
  }),
  quote: null,
  status: 'success',
  error_message: null,
  created_at: '',
  review_status: 'pending',
  reviewed_answer: null,
  reviewed_at: null,
  ...extra,
});

export const failure = (articleId: number, question: string, message = '401 chave recusada') =>
  answer(articleId, question, { answer: null, status: 'error', error_message: message });

export const record = (id: number, extra: Partial<InvestigationHistoryRecord> = {}): InvestigationHistoryRecord => ({
  id,
  created_at: '2026-11-01T10:00:00Z',
  status: 'Sucesso',
  model_used: 'Ollama (gpt-oss:120b)',
  questions: JSON.stringify(['Q1', 'Q2']),
  articles_ids: JSON.stringify([1, 2]),
  ...extra,
});

/** A service holding a project with these articles and investigations; results go by investigation id. */
export function investigationService(
  articles: Article[],
  history: InvestigationHistoryRecord[],
  results: Record<number, InvestigationResult[]> = {},
): FakeProjectService {
  const service = new FakeProjectService();
  service.getProject.mockResolvedValue({ id: 3, name: 'Revisão de teste' } as never);
  service.getArticles.mockResolvedValue(articles);
  service.getMassiveInvestigations.mockResolvedValue(history as MassiveInvestigation[]);
  service.getInvestigationResults.mockImplementation(async (id: number) => results[id] ?? []);
  service.reviewInvestigationResult.mockImplementation(
    async (id: number, review: { status: InvestigationResult['review_status']; answer?: string }) => {
      const row = Object.values(results)
        .flat()
        .find((r) => r.id === id);
      if (!row) throw new Error(`no result ${id}`);
      row.review_status = review.status;
      row.reviewed_answer = review.answer ?? null;
      return { ...row };
    },
  );
  return service;
}

const Where: React.FC = () => {
  const location = useLocation();
  return <output data-testid="where">{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
};

/** The page at an address, with the routes it links to and the run provider it needs. */
export function renderInvestigation(service: FakeProjectService, entry: string | { pathname: string; state: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <GlobalErrorProvider>
        <ServicesProvider apiService={service}>
          <InvestigationRunProvider>
            <Routes>
              <Route path="/projects/:id/investigation" element={<InvestigationPage />} />
              <Route path="/projects/:id/investigation/:view" element={<InvestigationPage />} />
              <Route path="*" element={<Where />} />
            </Routes>
          </InvestigationRunProvider>
        </ServicesProvider>
      </GlobalErrorProvider>
    </MemoryRouter>,
  );
}

/** Sets the window width the page reads, and tells it. */
export function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  // In act: a page still mounted measures itself again, and this also runs from afterEach, before it unmounts.
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}
