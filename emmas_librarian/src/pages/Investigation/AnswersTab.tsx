import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InvestigationResultBlock } from '../../components/ai/investigation/InvestigationResultBlock';
import { SideDrawer } from '../../components/common/SideDrawer';
import { useNarrowWindow } from '../../hooks/useNarrowWindow';
import { useSessionState } from '../../hooks/useSessionState';
import type { Article, InvestigationResult, RAGExtractionResult, ResultReview } from '../../types';
import { readerStateBackTo } from '../../utils/readerReturn';
import { AnswersGrid } from './AnswersGrid';
import {
  gridOrder,
  investigationPath,
  isPendingReview,
  matchesFilter,
  nextPending,
  type AnswerFilter,
} from './investigationView';

interface AnswersTabProps {
  projectId: number;
  investigationId: number;
  results: InvestigationResult[];
  questions: string[];
  articles: Article[];
  onReview: (resultId: number, review: ResultReview) => Promise<void>;
}

const FILTERS: { id: AnswerFilter; label: string }[] = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'reviewed', label: 'Revisadas' },
  { id: 'errors', label: 'Com erro' },
  { id: 'all', label: 'Todas' },
];

// Leaving for a PDF and coming back keeps the filter and the answer in view.
function useAnswersView(investigationId: number, results: InvestigationResult[], questions: string[]) {
  const key = `investigation.${investigationId}`;
  const [storedFilter, setFilter] = useSessionState<AnswerFilter | null>(`${key}.filter`, null);
  const [question, setQuestion] = useSessionState(`${key}.question`, 'all');
  const [selectedId, setSelectedId] = useSessionState<number | null>(`${key}.selected`, null);
  const filter = storedFilter ?? (results.some(isPendingReview) ? 'pending' : 'all');
  const shownQuestions = question === 'all' ? questions : questions.filter((q) => q === question);
  const ordered = gridOrder(results, questions);
  const visible = ordered.filter((r) => matchesFilter(r, filter) && shownQuestions.includes(r.question));
  return { filter, setFilter, question, setQuestion, selectedId, setSelectedId, shownQuestions, ordered, visible };
}

/**
 * The "Respostas" tab (#73): the grid article × question and, beside it, the selected answer with its evidence and
 * its review; on a narrow window the answer opens as a drawer over the grid.
 *
 * @example <AnswersTab projectId={3} investigationId={14} results={results} questions={qs} articles={as} onReview={r} />
 */
export const AnswersTab: React.FC<AnswersTabProps> = (props) => {
  const { projectId, investigationId, results, questions, articles, onReview } = props;
  const narrow = useNarrowWindow();
  const navigate = useNavigate();
  const view = useAnswersView(investigationId, results, questions);
  const { filter, ordered, visible, selectedId, setSelectedId } = view;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const selected = ordered.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  // A, E and R work on the focused review controls (#47), so choosing an answer puts the focus there.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    panel.current?.querySelector<HTMLElement>('[aria-label^="Revisão da resposta"]')?.focus({ preventScroll: true });
  }, [selected?.id]);

  const select = (id: number) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };
  const next = selected ? nextPending(ordered, selected.id) : null;
  const previous = visible[visible.findIndex((r) => r.id === selected?.id) - 1] ?? null;

  const review = async (result: InvestigationResult, decision: ResultReview) => {
    await onReview(result.id, decision);
    // Under "Pendentes" a marked answer leaves the grid, so the review carries on with the next one.
    const following = nextPending(ordered, result.id);
    if (decision.status !== 'pending' && filter === 'pending' && following) setSelectedId(following.id);
  };

  const openEvidence = (result: InvestigationResult) => (evidence: RAGExtractionResult['evidences'][0]) => {
    const back = readerStateBackTo({
      path: investigationPath(projectId, investigationId),
      label: 'Voltar à investigação',
    });
    navigate(`/articles/${result.article_id}`, { state: { searchQuery: evidence.text, page: evidence.page, ...back } });
  };

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowRight' && next) setSelectedId(next.id);
    if (e.key === 'ArrowLeft' && previous) setSelectedId(previous.id);
  };

  const answer = selected && (
    <div ref={panel} className="inv-answer" onKeyDown={onPanelKey}>
      <span className="inv-muted">
        {articles.find((a) => a.id === selected.article_id)?.title ?? `Artigo #${selected.article_id}`}
      </span>
      <InvestigationResultBlock
        key={selected.id}
        result={selected}
        onViewDocument={openEvidence(selected)}
        onReview={(decision) => review(selected, decision)}
      />
      <div className="inv-answer-nav">
        <button
          type="button"
          className="btn-secondary inv-small"
          disabled={!previous}
          onClick={() => previous && setSelectedId(previous.id)}
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="btn-secondary inv-small"
          disabled={!next}
          onClick={() => next && setSelectedId(next.id)}
        >
          Próxima pendente →
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AnswersToolbar results={results} questions={questions} view={view} />
      <div className="inv-split">
        <AnswersGrid
          results={visible}
          questions={view.shownQuestions}
          articles={articles}
          selectedId={selected?.id ?? null}
          onSelect={select}
        />
        {!narrow && answer && (
          <aside className="inv-card inv-side-panel" aria-label="Resposta selecionada">
            {answer}
          </aside>
        )}
      </div>
      {narrow && drawerOpen && answer && (
        <SideDrawer side="right" label="Resposta selecionada" onClose={() => setDrawerOpen(false)}>
          {answer}
        </SideDrawer>
      )}
    </>
  );
};

const AnswersToolbar: React.FC<{
  results: InvestigationResult[];
  questions: string[];
  view: ReturnType<typeof useAnswersView>;
}> = ({ results, questions, view }) => (
  <div className="inv-toolbar">
    {FILTERS.map((f) => (
      <button
        key={f.id}
        type="button"
        className="inv-filter"
        aria-pressed={view.filter === f.id}
        onClick={() => view.setFilter(f.id)}
      >
        {f.label} ({results.filter((r) => matchesFilter(r, f.id)).length})
      </button>
    ))}
    <select
      className="input-field input-compact inv-question-filter"
      aria-label="Pergunta"
      value={view.question}
      onChange={(e) => view.setQuestion(e.target.value)}
    >
      <option value="all">Todas as perguntas</option>
      {questions.map((q, i) => (
        <option key={q} value={q}>
          P{i + 1}. {q}
        </option>
      ))}
    </select>
    <span className="inv-muted inv-toolbar-end">A aceita · E edita · R rejeita · → próxima pendente</span>
  </div>
);
