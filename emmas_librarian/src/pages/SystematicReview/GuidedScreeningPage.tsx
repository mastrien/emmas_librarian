import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Article, ScreeningStage } from '../../types';
import { useScreening } from './useScreening';
import { useGuidedScreening, type GuidedScreening } from './useGuidedScreening';
import { GuidedDecisionPanel } from './GuidedDecisionPanel';
import { articleMeta, databasesOf } from './reviewText';
import { CriteriaModal } from './CriteriaModal';
import { SuggestionBlock } from './SuggestionBlock';
import { OrderToggle, ScreeningOrderStrip, useScreeningOrder, type ScreeningOrder } from './ScreeningOrderStrip';
import { useScreeningSuggestions } from './useScreeningSuggestions';
import { hasCriteria } from '../../utils/screeningCriteria';
import { readerStateBackTo } from '../../utils/readerReturn';
import './review.css';
import './guided.css';
import { BackLink } from '../../components/common/BackLink';

const STAGES: { id: ScreeningStage; label: string }[] = [
  { id: 'title', label: 'Título e resumo' },
  { id: 'full', label: 'Texto completo' },
];

const StageTabs: React.FC<{ guided: GuidedScreening }> = ({ guided }) => (
  <div role="tablist" aria-label="Etapa" className="segmented guided-stage-tabs">
    {STAGES.map((s) => (
      <button
        key={s.id}
        type="button"
        role="tab"
        aria-selected={guided.stage === s.id}
        className="segmented-option"
        onClick={() => guided.setStage(s.id)}
      >
        {s.label}
      </button>
    ))}
  </div>
);

const decidedCount = (guided: GuidedScreening) =>
  guided.tally.include + guided.tally.maybe + guided.tally.exclude + guided.tally.removed;

// The kinds' shares of the bar, as a CSS variable guided.css reads.
const ProgressBar: React.FC<{ guided: GuidedScreening }> = ({ guided }) => {
  const total = guided.poolSize || 1;
  const share = (n: number) => ({ '--share': `${(n / total) * 100}%` }) as React.CSSProperties;
  return (
    <div aria-hidden="true" className="guided-progress-bar">
      {(['include', 'maybe', 'exclude', 'removed'] as const).map((kind) => (
        <span key={kind} className={`review-dot--${kind}`} style={share(guided.tally[kind])} />
      ))}
    </div>
  );
};

// Escape leaves the screening, unless a note is being typed or a window is open (those use Escape themselves).
function useExitOnEscape(onExit: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);
}

/**
 * The bar of the focus mode (board 165): the way out with its key, where the screening stands, the stage, the filter
 * of pending articles and, at the right, the prediction toggle. The order's own messages come in the band below.
 */
const FocusBar: React.FC<{ projectId: number; guided: GuidedScreening; order: ScreeningOrder }> = ({
  projectId,
  guided,
  order,
}) => (
  <header className="guided-bar">
    <BackLink to={`/projects/${projectId}/review`}>
      Sair da triagem <kbd className="guided-key">Esc</kbd>
    </BackLink>
    <span className="guided-bar__sep" aria-hidden="true" />
    <div className="guided-bar__progress">
      <div className="guided-bar__line">
        <strong>
          {guided.queue.length
            ? `Artigo ${guided.position + 1} de ${guided.queue.length}`
            : 'Nenhum artigo nesta etapa'}
        </strong>
        <span className="review-muted">{decidedCount(guided)} decididos</span>
      </div>
      <ProgressBar guided={guided} />
    </div>
    <StageTabs guided={guided} />
    <label className="guided-check">
      <input type="checkbox" checked={guided.onlyPending} onChange={guided.toggleOnlyPending} /> Só pendentes
    </label>
    {guided.stage === 'title' && <OrderToggle order={order} />}
  </header>
);

// The words the suggestion leans on, marked in place so the person reads them in context.
const Abstract: React.FC<{ text: string; quote: string | null }> = ({ text, quote }) => {
  const at = quote ? text.indexOf(quote) : -1;
  if (!quote || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{quote}</mark>
      {text.slice(at + quote.length)}
    </>
  );
};

const ArticleCard: React.FC<{ article: Article; guided: GuidedScreening; quote: string | null }> = ({
  article,
  guided,
  quote,
}) => (
  <article className="guided-article">
    <div className="guided-chips">
      {databasesOf(article).map((db) => (
        <span key={db} className="review-chip review-chip--none">
          {db}
        </span>
      ))}
    </div>
    <h2>{article.title}</h2>
    <span className="review-muted">{articleMeta(article)}</span>
    {guided.stage === 'full' && (
      <div className="review-counts">
        <span>{article.local_file_path ? 'PDF anexado ao artigo.' : 'Sem PDF anexado.'}</span>
        <Link
          to={`/articles/${article.id}`}
          state={readerStateBackTo({
            path: `/projects/${article.project_id}/review/guided`,
            label: 'Voltar à triagem guiada',
          })}
          className="review-small"
        >
          {article.local_file_path ? 'Abrir PDF' : 'Abrir o artigo'}
        </Link>
      </div>
    )}
    <h3 className="review-menu-title guided-abstract-title">Resumo</h3>
    <p className="guided-abstract">
      {article.abstract ? <Abstract text={article.abstract} quote={quote} /> : 'Sem resumo cadastrado.'}
    </p>
  </article>
);

const Finished: React.FC<{ guided: GuidedScreening; projectId: number }> = ({ guided, projectId }) => (
  <div className="review-section guided-finished">
    <h2>
      {guided.poolSize === 0
        ? 'Nenhum artigo chegou a esta etapa ainda'
        : guided.stage === 'title'
          ? 'Triagem por título e resumo concluída'
          : 'Avaliação do texto completo concluída'}
    </h2>
    <div className="guided-row">
      <span className="review-chip review-chip--include">{guided.tally.include} incluídos</span>
      <span className="review-chip review-chip--maybe">{guided.tally.maybe} em dúvida</span>
      <span className="review-chip review-chip--exclude">{guided.tally.exclude} excluídos</span>
      {guided.tally.removed > 0 && (
        <span className="review-chip review-chip--removed">
          {guided.tally.removed} duplicados (removidos antes da triagem)
        </span>
      )}
    </div>
    <p className="review-muted guided-finished-text">
      {guided.stage === 'title'
        ? 'Os incluídos e os em dúvida passam para a etapa de texto completo. Os excluídos já estão arquivados no projeto, com o motivo.'
        : 'Os incluídos aparecem na seção do rótulo na página da revisão; os excluídos ficam arquivados no projeto com o motivo desta etapa.'}
    </p>
    <div className="guided-row">
      {guided.stage === 'title' && (
        <button type="button" className="btn-primary" onClick={() => guided.setStage('full')}>
          Ir para texto completo
        </button>
      )}
      {guided.poolSize > 0 && (
        <button type="button" className="btn-secondary" onClick={guided.reviewAll}>
          Rever todos desta etapa
        </button>
      )}
      <Link to={`/projects/${projectId}/review`} className="btn-secondary">
        Voltar à revisão
      </Link>
    </div>
  </div>
);

/**
 * The guided screening (#49): one article at a time, title and abstract first, then full text, with keyboard
 * decisions, a note, undo and a filter of pending articles. Its decisions are the same as the review page's.
 *
 * Usage:
 *   <Route path="/projects/:id/review/guided" element={<GuidedScreeningPage />} />
 */
export const GuidedScreeningPage: React.FC = () => {
  const projectId = Number(useParams<{ id: string }>().id);
  const screening = useScreening(projectId);
  const order = useScreeningOrder(projectId, screening.decisions);
  const guided = useGuidedScreening(screening, projectId, order.queue);
  const suggestions = useScreeningSuggestions(projectId);
  const [writingCriteria, setWritingCriteria] = useState(false);
  const navigate = useNavigate();
  useExitOnEscape(() => navigate(`/projects/${projectId}/review`));
  if (screening.loading) return <div className="review review-muted">Carregando a triagem…</div>;
  const article = guided.current;
  // Suggestions read title and abstract, so they belong to that stage only.
  const suggesting = guided.stage === 'title' && article !== null;
  const suggestion = suggesting ? suggestions.forArticle(article.id) : null;
  const canAsk = suggesting && !!article.abstract?.trim() && hasCriteria(suggestions.criteria);
  const asking = canAsk && suggestions.running === null && (!suggestion || suggestions.isStale(suggestion));
  return (
    <div className="guided-page fade-in">
      <FocusBar projectId={projectId} guided={guided} order={order} />
      {guided.stage === 'title' && (
        <ScreeningOrderStrip order={order} decisions={screening.decisions} labels={screening.labels} />
      )}
      {guided.finished || !article ? (
        <Finished guided={guided} projectId={projectId} />
      ) : (
        <div className="guided-body">
          <main className="guided-main">
            <ArticleCard article={article} guided={guided} quote={suggestion?.quote_found ? suggestion.quote : null} />
          </main>
          <GuidedDecisionPanel
            key={`${guided.stage}-${article.id}`}
            canGoBack={guided.position > 0}
            canGoOn={guided.position < guided.queue.length - 1}
            canUndo={guided.canUndo}
            options={guided.options}
            duplicate={guided.duplicate}
            decision={guided.decisionHere}
            onDecide={(label, note) => void guided.decide(label, note)}
            onMove={guided.go}
            onUndo={() => void guided.undo()}
            suggestedLabelId={suggestion?.label_id ?? null}
            onSuggest={asking ? () => void suggestions.suggest(article.id) : undefined}
            suggestion={
              suggesting && (
                <SuggestionBlock
                  suggestion={suggestion}
                  stale={!!suggestion && suggestions.isStale(suggestion)}
                  running={suggestions.running === article.id}
                  failure={suggestions.failureOf(article.id)}
                  hasCriteria={hasCriteria(suggestions.criteria)}
                  hasAbstract={!!article.abstract?.trim()}
                  labels={screening.labels}
                  provider={suggestions.engine?.provider ?? null}
                  onSuggest={() => void suggestions.suggest(article.id)}
                  onWriteCriteria={() => setWritingCriteria(true)}
                />
              )
            }
          />
        </div>
      )}
      {writingCriteria && (
        <CriteriaModal
          projectId={projectId}
          onClose={() => setWritingCriteria(false)}
          onSaved={suggestions.setCriteria}
        />
      )}
    </div>
  );
};

export default GuidedScreeningPage;
