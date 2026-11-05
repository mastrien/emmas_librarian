import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GuidedScreeningPage } from '../GuidedScreeningPage';
import { SystematicReviewPage } from '../SystematicReviewPage';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import type { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type { ScreeningSuggestion } from '../../../types';
import { criteriaSnapshot } from '../../../utils/screeningCriteria';
import { EXCLUDED, INCLUDED, MAYBE, reviewArticle, screeningService, storedDecision } from './screeningTestData';

const CRITERIA = { inclusion: 'adultos', exclusion: 'internados' };
const ABSTRACT = 'Um ensaio clínico com 412 adultos em atenção primária.';
const QUOTE = '412 adultos';

const suggestionOf = (articleId: number, extra: Partial<ScreeningSuggestion> = {}): ScreeningSuggestion => ({
  id: articleId,
  article_id: articleId,
  label_id: INCLUDED,
  engine: 'ollama/llama3.1',
  criteria: criteriaSnapshot(CRITERIA),
  confidence: 0.88,
  reason: 'Atende aos critérios.',
  quote: QUOTE,
  quote_found: 1,
  elapsed_ms: 2000,
  tokens_estimated: 500,
  created_at: '',
  ...extra,
});

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
        <Routes>
          <Route path="/projects/:id/review/guided" element={<GuidedScreeningPage />} />
          <Route path="/projects/:id/review/evaluation" element={<SystematicReviewPage tab="evaluation" />} />
          <Route path="/projects/:id/review" element={<SystematicReviewPage />} />
        </Routes>
      </ServicesProvider>
    </MemoryRouter>,
  );
  await settle();
}

describe('asking for a suggestion in the guided screening (#54)', () => {
  const guidedService = (criteria = CRITERIA, abstract = ABSTRACT) => {
    const service = screeningService([
      reviewArticle(1, 'ConvLSTM', { abstract }),
      reviewArticle(2, 'MetNet', { abstract }),
    ]);
    service.getScreeningCriteria.mockResolvedValue(criteria);
    return service;
  };
  const openGuided = (service: FakeProjectService) => renderAt(service, '/projects/1/review/guided');

  it('asks nothing by itself, and says where the text goes', async () => {
    const service = guidedService();

    await openGuided(service);

    expect(service.suggestScreening).not.toHaveBeenCalled();
    expect(screen.getByText('Envia título, resumo e critérios para Ollama (local).')).toBeInTheDocument();
  });

  it('shows the suggestion when asked, marks the quote and the label, and decides nothing', async () => {
    const service = guidedService();
    service.suggestScreening.mockResolvedValue(suggestionOf(1));
    await openGuided(service);

    await press(screen.getByRole('button', { name: 'Sugerir (S)' }));

    expect(service.suggestScreening).toHaveBeenCalledWith(1);
    expect(screen.getByText('A IA sugere: Incluso')).toBeInTheDocument();
    expect(screen.getByText('confiança 88%')).toBeInTheDocument();
    expect(screen.getByText(QUOTE).tagName).toBe('MARK');
    expect(screen.getByRole('button', { name: /Incluso.*sugerido/ })).toBeInTheDocument();
    expect(service.decideScreening).not.toHaveBeenCalled();
  });

  it('asks with the S key', async () => {
    const service = guidedService();
    service.suggestScreening.mockResolvedValue(suggestionOf(1));
    await openGuided(service);

    fireEvent.keyDown(window, { key: 's' });
    await settle();

    expect(service.suggestScreening).toHaveBeenCalledWith(1);
  });

  it('does not ask while the note is being typed', async () => {
    const service = guidedService();
    await openGuided(service);

    fireEvent.keyDown(screen.getByRole('textbox', { name: /Nota/ }), { key: 's' });
    await settle();

    expect(service.suggestScreening).not.toHaveBeenCalled();
  });

  it('accepting is the usual button, and the decision is the person’s', async () => {
    const service = guidedService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1)]);
    await openGuided(service);

    await press(screen.getByRole('button', { name: /Incluso.*sugerido/ }));

    expect(service.decideScreening).toHaveBeenCalledWith([1], INCLUDED, 'title', null);
  });

  it('shows the one already kept without asking again, and the S key costs nothing', async () => {
    const service = guidedService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1)]);
    await openGuided(service);

    fireEvent.keyDown(window, { key: 's' });
    await settle();

    expect(screen.getByText('A IA sugere: Incluso')).toBeInTheDocument();
    expect(service.suggestScreening).not.toHaveBeenCalled();
  });

  it('ignores what another engine suggested', async () => {
    const service = guidedService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1, { engine: 'gemini/outro' })]);
    await openGuided(service);

    expect(screen.queryByText(/A IA sugere/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sugerir (S)' })).toBeInTheDocument();
  });

  it('warns when the quote is not in the abstract, keeping the suggestion', async () => {
    const service = guidedService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1, { quote: 'inventado', quote_found: 0 })]);
    await openGuided(service);

    expect(screen.getByRole('note')).toHaveTextContent('A IA pode ter inventado');
    expect(screen.getByText('A IA sugere: Incluso')).toBeInTheDocument();
    expect(screen.queryByText('inventado')).not.toBeInTheDocument();
  });

  it('warns when the model pointed at no quote', async () => {
    const service = guidedService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1, { quote: null, quote_found: 0 })]);
    await openGuided(service);

    expect(screen.getByRole('note')).toHaveTextContent('não apontou um trecho');
  });

  it('says when the criteria changed, and asks again only when told to', async () => {
    const service = guidedService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1, { criteria: 'outros' })]);
    service.suggestScreening.mockResolvedValue(suggestionOf(1));
    await openGuided(service);

    expect(screen.getByText('Esta sugestão usou os critérios anteriores.')).toBeInTheDocument();
    expect(service.suggestScreening).not.toHaveBeenCalled();
    await press(screen.getByRole('button', { name: /Sugerir de novo/ }));

    expect(service.suggestScreening).toHaveBeenCalledWith(1);
    expect(screen.queryByText('Esta sugestão usou os critérios anteriores.')).not.toBeInTheDocument();
  });

  it('says it is reading', async () => {
    const service = guidedService();
    service.suggestScreening.mockImplementation(() => new Promise(() => undefined));
    await openGuided(service);

    await press(screen.getByRole('button', { name: 'Sugerir (S)' }));

    expect(screen.getByRole('status')).toHaveTextContent('A IA está lendo');
  });

  it('shows why it could not suggest, and offers to try again', async () => {
    const service = guidedService();
    service.suggestScreening.mockRejectedValueOnce(new Error('chave recusada'));
    service.suggestScreening.mockResolvedValueOnce(suggestionOf(1));
    await openGuided(service);

    await press(screen.getByRole('button', { name: 'Sugerir (S)' }));
    expect(screen.getByRole('alert')).toHaveTextContent('chave recusada');
    await press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(screen.getByText('A IA sugere: Incluso')).toBeInTheDocument();
  });

  it('asks for the criteria first, saves them and then offers the suggestion', async () => {
    const service = guidedService({ inclusion: '', exclusion: '' });
    await openGuided(service);
    expect(screen.queryByRole('button', { name: 'Sugerir (S)' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 's' });
    expect(service.suggestScreening).not.toHaveBeenCalled();

    await press(screen.getByRole('button', { name: 'Escrever os critérios' }));
    const dialog = screen.getByRole('dialog', { name: 'Critérios de inclusão e exclusão' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Incluir quando' }), { target: { value: 'adultos' } });
    await press(within(dialog).getByRole('button', { name: 'Fechar os critérios' }));

    expect(service.saveScreeningCriteria).toHaveBeenCalledWith(1, { inclusion: 'adultos', exclusion: '' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sugerir (S)' })).toBeInTheDocument();
  });

  it('says there is nothing to read without an abstract', async () => {
    const service = guidedService(CRITERIA, '');
    await openGuided(service);

    expect(screen.getByText(/não tem resumo, então não há o que a IA leia/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 's' });
    expect(service.suggestScreening).not.toHaveBeenCalled();
  });

  it('has no suggestion at full text', async () => {
    const service = screeningService(
      [reviewArticle(1, 'ConvLSTM', { abstract: ABSTRACT })],
      [storedDecision(1, MAYBE)],
    );
    service.getScreeningCriteria.mockResolvedValue(CRITERIA);
    await openGuided(service);

    await press(screen.getByRole('tab', { name: 'Texto completo' }));

    expect(screen.queryByRole('button', { name: 'Sugerir (S)' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 's' });
    expect(service.suggestScreening).not.toHaveBeenCalled();
  });
});

describe('the criteria of the project (#54)', () => {
  it('opens from the review page with what is stored, and saves on leaving a field', async () => {
    const service = screeningService([reviewArticle(1, 'ConvLSTM')]);
    service.getScreeningCriteria.mockResolvedValue(CRITERIA);
    await renderAt(service, '/projects/1/review');

    await press(screen.getByRole('button', { name: 'Critérios' }));
    const exclusion = screen.getByRole('textbox', { name: 'Excluir quando' });
    expect(exclusion).toHaveValue('internados');
    fireEvent.change(exclusion, { target: { value: 'crianças' } });
    fireEvent.blur(exclusion);
    await settle();

    expect(service.saveScreeningCriteria).toHaveBeenCalledWith(1, { inclusion: 'adultos', exclusion: 'crianças' });
  });
});

describe('evaluating the suggestions (#54)', () => {
  const evaluationService = () => {
    const service = screeningService(
      [
        reviewArticle(1, 'Incluído certo', { abstract: ABSTRACT }),
        reviewArticle(2, 'Relevante perdido', { abstract: ABSTRACT }),
        reviewArticle(3, 'Excluído', { abstract: ABSTRACT }),
        reviewArticle(4, 'Sem decisão', { abstract: ABSTRACT }),
        reviewArticle(5, 'Sem resumo', { abstract: '' }),
      ],
      [storedDecision(1, INCLUDED), storedDecision(2, MAYBE), storedDecision(3, EXCLUDED), storedDecision(5, INCLUDED)],
    );
    service.getScreeningCriteria.mockResolvedValue(CRITERIA);
    return service;
  };
  const openEvaluation = (service: FakeProjectService) => renderAt(service, '/projects/1/review/evaluation');

  it('says what it would send before anything is spent', async () => {
    const service = evaluationService();

    await openEvaluation(service);

    expect(screen.getByText(/de 3 artigos para Ollama \(local\). Isso consome tokens/)).toBeInTheDocument();
    expect(service.suggestScreening).not.toHaveBeenCalled();
  });

  it('asks about what was decided and has an abstract, then shows the measures', async () => {
    const service = evaluationService();
    service.suggestScreening.mockImplementation(async (id: number) =>
      suggestionOf(id, { label_id: id === 1 ? INCLUDED : EXCLUDED, confidence: 0.9 }),
    );
    await openEvaluation(service);

    await press(screen.getByRole('button', { name: 'Avaliar' }));

    expect(service.suggestScreening.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
    const row = screen.getByRole('row', { name: /ollama\/llama3.1/ });
    expect(row).toHaveTextContent('50% (1 de 2)');
    expect(row).toHaveTextContent('100% (1 de 1)');
    expect(row).toHaveTextContent('66,7% (2 de 3)');
    expect(screen.getByText('Relevante perdido')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('cada erro muda o recall em 50,0 pontos');
  });

  it('pays only for what is missing', async () => {
    const service = evaluationService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1), suggestionOf(2)]);
    service.suggestScreening.mockImplementation(async (id: number) => suggestionOf(id));
    await openEvaluation(service);

    await press(screen.getByRole('button', { name: 'Avaliar' }));

    expect(service.suggestScreening.mock.calls.map(([id]) => id)).toEqual([3]);
  });

  it('has nothing to pay for when all is evaluated', async () => {
    const service = evaluationService();
    service.getScreeningSuggestions.mockResolvedValue([suggestionOf(1), suggestionOf(2), suggestionOf(3)]);
    await openEvaluation(service);

    expect(screen.getByRole('button', { name: 'Avaliar' })).toBeDisabled();
    expect(screen.queryByText(/Isso consome tokens/)).not.toBeInTheDocument();
  });

  it('shows engines side by side', async () => {
    const service = evaluationService();
    service.getScreeningSuggestions.mockResolvedValue([
      suggestionOf(1),
      suggestionOf(1, { id: 9, engine: 'gemini/outro', label_id: EXCLUDED }),
    ]);
    await openEvaluation(service);

    expect(screen.getByRole('row', { name: /ollama\/llama3.1/ })).toHaveTextContent('100% (1 de 1)');
    expect(screen.getByRole('row', { name: /gemini\/outro/ })).toHaveTextContent('0% (0 de 1)');
  });

  it('stops after three failures in a row, saying why', async () => {
    const service = evaluationService();
    service.suggestScreening.mockRejectedValue(new Error('chave recusada'));
    service.getArticles.mockResolvedValue(
      [1, 2, 3, 4, 5].map((id) => reviewArticle(id, `Artigo ${id}`, { abstract: ABSTRACT })),
    );
    service.screeningDecisions = [1, 2, 3, 4, 5].map((id) => storedDecision(id, INCLUDED));
    await openEvaluation(service);

    await press(screen.getByRole('button', { name: 'Avaliar' }));

    expect(service.suggestScreening).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('alert')).toHaveTextContent('chave recusada');
  });

  it('stops when told to, keeping what arrived', async () => {
    const service = evaluationService();
    let answer: (s: ScreeningSuggestion) => void = () => undefined;
    service.suggestScreening.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    await openEvaluation(service);

    await press(screen.getByRole('button', { name: 'Avaliar' }));
    expect(screen.getByRole('status')).toHaveTextContent('Avaliando 1 de 3');
    await press(screen.getByRole('button', { name: 'Parar' }));
    await act(async () => answer(suggestionOf(1)));

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(service.suggestScreening).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('row', { name: /ollama\/llama3.1/ })).toBeInTheDocument();
  });

  it('offers a sample only when there is more than one', async () => {
    const service = evaluationService();
    await openEvaluation(service);

    expect(screen.queryByRole('option', { name: /Amostra/ })).not.toBeInTheDocument();
  });

  it('sends only the sample when one is chosen', async () => {
    const service = evaluationService();
    const many = Array.from({ length: 60 }, (_, i) => i + 1);
    service.getArticles.mockResolvedValue(many.map((id) => reviewArticle(id, `Artigo ${id}`, { abstract: ABSTRACT })));
    service.screeningDecisions = many.map((id) => storedDecision(id, INCLUDED));
    service.suggestScreening.mockImplementation(async (id: number) => suggestionOf(id));
    await openEvaluation(service);

    fireEvent.change(screen.getByRole('combobox', { name: 'Artigos' }), { target: { value: 'sample' } });
    await press(screen.getByRole('button', { name: 'Avaliar' }));

    expect(service.suggestScreening).toHaveBeenCalledTimes(50);
  });

  it('says what is missing before it can evaluate', async () => {
    const service = screeningService([reviewArticle(1, 'ConvLSTM')]);
    await openEvaluation(service);

    expect(screen.getByText(/Decida alguns artigos com resumo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escrever os critérios do projeto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Avaliar' })).not.toBeInTheDocument();
  });
});
