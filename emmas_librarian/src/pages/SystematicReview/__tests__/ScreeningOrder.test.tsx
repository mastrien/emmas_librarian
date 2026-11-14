import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GuidedScreeningPage } from '../GuidedScreeningPage';
import { SystematicReviewPage } from '../SystematicReviewPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { EXCLUDED, INCLUDED, MAYBE, reviewArticle, screeningService, storedDecision } from './screeningTestData';
import { predictedOrder, recentRelevant } from '../../../utils/screeningView';
import type { ScreeningLabel } from '../../../types';
import { FakeDialogsProvider } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';

// A canvas is not drawn in jsdom; what the chart receives is what matters here.
vi.mock('react-chartjs-2', () => ({
  Line: ({ data }: { data: { datasets: { label: string; data: number[] }[] } }) => (
    <div data-testid="chart">{data.datasets.map((d) => `${d.label}: ${d.data.join()}`).join(' | ')}</div>
  ),
}));

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });

async function press(element: Element) {
  fireEvent.click(element);
  await settle();
}

async function renderAt(service: FakeProjectService, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider apiService={service}>
        <FakeDialogsProvider>
          <Routes>
            <Route path="/projects/:id/review/guided" element={<GuidedScreeningPage />} />
            <Route path="/projects/:id/review/evaluation" element={<SystematicReviewPage tab="evaluation" />} />
          </Routes>
        </FakeDialogsProvider>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await settle();
}

const articles = [reviewArticle(1, 'Primeiro'), reviewArticle(2, 'Segundo'), reviewArticle(3, 'Terceiro')];
const ready = { order: [3, 1, 2], learnedFrom: 67, needRelevant: 0, needExcluded: 0 };
const plan = (extra = {}) => ({ total: 3, pending: 0, provider: 'ollama', previousModel: null, ...extra });
const toggle = () => screen.getByRole('switch', { name: /Ordenar por relevância prevista/ });
const heading = (title: string) => screen.findByRole('heading', { name: title, level: 2 });

describe('the predicted order in the guided screening (#55)', () => {
  const guided = (service: FakeProjectService) => renderAt(service, '/projects/1/review/guided');

  it('is off by default: original order, and nothing asked of anyone', async () => {
    const service = screeningService(articles);

    await guided(service);

    expect(toggle()).not.toBeChecked();
    expect(await heading('Primeiro')).toBeInTheDocument();
    expect(service.getArticleVectorPlan).not.toHaveBeenCalled();
    expect(service.rankScreening).not.toHaveBeenCalled();
    // The switch carries its "Experimental" tag, in the bar; the band under it stays out while there is nothing to say.
    expect(within(toggle().closest('span')!).getByText('Experimental')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ordem da triagem' })).not.toBeInTheDocument();
  });

  it('remembers the choice of the project, and opens on the likeliest', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.rankScreening.mockResolvedValue(ready);

    await guided(service);

    expect(toggle()).toBeChecked();
    expect(await heading('Terceiro')).toBeInTheDocument();
    expect(screen.getByText('Ordem prevista, aprendida com 67 decisões.')).toBeInTheDocument();
  });

  it('saves the choice, and asks before generating the vectors', async () => {
    const service = screeningService(articles);
    service.getArticleVectorPlan.mockResolvedValue(plan({ pending: 3 }));
    await guided(service);

    await press(toggle());

    expect(service.setScreeningOrderOn).toHaveBeenCalledWith(1, true);
    expect(screen.getByText('Gerar os vetores de 3 artigos?')).toBeInTheDocument();
    expect(screen.getByText(/Envia título e resumo para Ollama \(local\)/)).toBeInTheDocument();
    expect(service.generateArticleVectors).not.toHaveBeenCalled();
  });

  it('generates when told to, batch after batch, and then orders', async () => {
    const service = screeningService(articles);
    service.getArticleVectorPlan.mockResolvedValueOnce(plan({ pending: 3 })).mockResolvedValue(plan());
    service.generateArticleVectors
      .mockResolvedValueOnce({ generated: 2, pending: 1 })
      .mockResolvedValueOnce({ generated: 1, pending: 0 });
    service.rankScreening.mockResolvedValue(ready);
    service.isScreeningOrderOn.mockResolvedValue(true);
    await guided(service);

    await press(screen.getByRole('button', { name: 'Gerar e ordenar' }));

    expect(service.generateArticleVectors).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Ordem prevista, aprendida com 67 decisões.')).toBeInTheDocument();
  });

  it('says how far the generation got', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan({ pending: 3 }));
    service.generateArticleVectors.mockImplementation(() => new Promise(() => undefined));
    await guided(service);

    await press(screen.getByRole('button', { name: 'Gerar e ordenar' }));

    expect(screen.getByRole('status')).toHaveTextContent('Gerando vetores: 0 de 3');
  });

  it('says what went wrong and offers to try again, keeping every article in the queue', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan({ pending: 3 }));
    service.generateArticleVectors.mockRejectedValue(new Error('provedor fora do ar'));
    await guided(service);

    await press(screen.getByRole('button', { name: 'Gerar e ordenar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('provedor fora do ar');
    expect(screen.getByRole('button', { name: 'Gerar e ordenar' })).toBeInTheDocument();
    expect(screen.getByText('Artigo 1 de 3')).toBeInTheDocument();
  });

  it('names the model the vectors came from, with the way to the settings', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan({ pending: 3, previousModel: 'ollama/nomic-embed-text' }));
    await guided(service);

    expect(screen.getByTestId('previous-vector-model')).toHaveTextContent('nomic-embed-text (Ollama)');
    expect(within(screen.getByTestId('previous-vector-model')).getByRole('link')).toHaveAttribute(
      'href',
      '/settings/ai',
    );
  });

  it('says how many examples are missing, keeping the original order', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.rankScreening.mockResolvedValue({ order: [], learnedFrom: 2, needRelevant: 2, needExcluded: 1 });

    await guided(service);

    expect(screen.getByText(/Faltam 2 relevantes e 1 excluído para começar a ordenar/)).toBeInTheDocument();
    expect(await heading('Primeiro')).toBeInTheDocument();
  });

  it('offers to generate what is new, leaving it at the end meanwhile', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan({ pending: 1 }));
    service.rankScreening.mockResolvedValue({ ...ready, order: [3, 1] });

    await guided(service);

    expect(screen.getByText('1 artigo sem vetor no fim da fila.')).toBeInTheDocument();
    expect(service.generateArticleVectors).not.toHaveBeenCalled();
  });

  it('after a decision goes to the likeliest left and learns again, deciding nothing else', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.rankScreening.mockResolvedValueOnce(ready).mockResolvedValue({ ...ready, order: [2, 1], learnedFrom: 68 });
    await guided(service);
    await heading('Terceiro');

    fireEvent.keyDown(window, { key: 'a' });
    await settle();

    expect(service.decideScreening).toHaveBeenCalledTimes(1);
    expect(service.decideScreening).toHaveBeenCalledWith([3], INCLUDED, 'title', null);
    expect(service.rankScreening).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Ordem prevista, aprendida com 68 decisões.')).toBeInTheDocument();
    expect(await heading('Primeiro')).toBeInTheDocument();
  });

  it('shows what was observed lately, and no estimate of what is left', async () => {
    const service = screeningService(articles, [storedDecision(1, INCLUDED), storedDecision(2, EXCLUDED)]);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.rankScreening.mockResolvedValue({ ...ready, order: [3] });

    await guided(service);

    expect(screen.getByText('Nos últimos 2 artigos, 1 relevante.')).toBeInTheDocument();
    expect(screen.queryByText(/estimad|restam|faltam cerca/i)).not.toBeInTheDocument();
  });

  it('can be turned off, going back to the original order', async () => {
    const service = screeningService(articles);
    service.isScreeningOrderOn.mockResolvedValue(true);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.rankScreening.mockResolvedValue(ready);
    await guided(service);

    await press(toggle());

    expect(service.setScreeningOrderOn).toHaveBeenCalledWith(1, false);
    expect(toggle()).not.toBeChecked();
    expect(screen.queryByText(/Ordem prevista, aprendida/)).not.toBeInTheDocument();
  });

  it('is not at full text', async () => {
    const service = screeningService(articles, [storedDecision(1, MAYBE)]);
    await guided(service);

    await press(screen.getByRole('tab', { name: 'Texto completo' }));

    expect(screen.queryByRole('checkbox', { name: /Ordenar/ })).not.toBeInTheDocument();
  });
});

describe('simulating the order (#55)', () => {
  const evaluation = (service: FakeProjectService) => renderAt(service, '/projects/1/review/evaluation');
  const simulation = {
    articles: 4,
    relevant: 2,
    predicted: [1, 2, 2, 2],
    original: [0, 0, 1, 2],
    withoutVector: 1,
  };

  it('shows the headline, the chart and the table, and repeats nothing by itself', async () => {
    const service = screeningService(articles);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.simulateScreening.mockResolvedValue(simulation);
    await evaluation(service);
    expect(service.simulateScreening).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('region', { name: 'Simular a ordenação' })).getByText('Experimental'),
    ).toBeInTheDocument();

    await press(screen.getByRole('button', { name: 'Simular' }));

    expect(
      screen.getByText(/Com a ordem prevista, 1 dos 2 relevantes apareceriam nos primeiros 1 artigos/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toHaveTextContent('Ordem prevista: 1,2,2,2 | Ordem original: 0,0,1,2');
    expect(screen.getByRole('row', { name: '4 2 2' })).toBeInTheDocument();
    expect(screen.getByText(/1 artigos decididos ficaram de fora/)).toBeInTheDocument();
  });

  it('asks for the vectors first, saying where they go', async () => {
    const service = screeningService(articles);
    service.getArticleVectorPlan.mockResolvedValueOnce(plan({ pending: 3 })).mockResolvedValue(plan());
    service.generateArticleVectors.mockResolvedValue({ generated: 3, pending: 0 });
    await evaluation(service);
    expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled();
    expect(screen.getByText(/Gerar envia título e resumo para Ollama \(local\)/)).toBeInTheDocument();

    await press(screen.getByRole('button', { name: 'Gerar 3 vetores' }));

    expect(service.generateArticleVectors).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simular' })).toBeEnabled());
  });

  it('says what is missing when nothing was decided', async () => {
    const service = screeningService(articles);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    await evaluation(service);

    await press(screen.getByRole('button', { name: 'Simular' }));

    expect(screen.getByText('Decida alguns artigos na triagem para poder simular.')).toBeInTheDocument();
  });

  it('shows why it could not simulate', async () => {
    const service = screeningService(articles);
    service.getArticleVectorPlan.mockResolvedValue(plan());
    service.simulateScreening.mockRejectedValue(new Error('banco ocupado'));
    await evaluation(service);

    await press(screen.getByRole('button', { name: 'Simular' }));

    expect(screen.getByRole('alert')).toHaveTextContent('banco ocupado');
  });
});

describe('screening view helpers (#55)', () => {
  const decisions = [storedDecision(1, INCLUDED)];

  it('puts the decided first, then the order predicted, then what has no vector', () => {
    const pool = [...articles, reviewArticle(4, 'Quarto')];

    expect(predictedOrder(pool, [3, 2], decisions).map((a) => a.id)).toEqual([1, 3, 2, 4]);
  });

  it('never loses an article', () => {
    expect(predictedOrder(articles, [99], []).map((a) => a.id)).toEqual([1, 2, 3]);
  });

  const labels = [
    { id: 1, kind: 'include' },
    { id: 2, kind: 'maybe' },
    { id: 3, kind: 'exclude' },
    { id: 4, kind: 'removed' },
  ] as ScreeningLabel[];
  const at = (id: number, labelId: number, decidedAt: string, stage: 'title' | 'full' = 'title') => ({
    ...storedDecision(id, labelId, stage),
    decided_at: decidedAt,
  });

  it('counts the latest decisions, with "em dúvida" as relevant, leaving out duplicates and full text', () => {
    const recent = [
      at(1, 1, '2026-01-01'),
      at(2, 3, '2026-01-02'),
      at(3, 2, '2026-01-03'),
      at(4, 4, '2026-01-04'),
      at(5, 1, '2026-01-05', 'full'),
    ];

    expect(recentRelevant(recent, labels, 2)).toEqual({ relevant: 1, looked: 2 });
    expect(recentRelevant(recent, labels, 50)).toEqual({ relevant: 2, looked: 3 });
  });
});
