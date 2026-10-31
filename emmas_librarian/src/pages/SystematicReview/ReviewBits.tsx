import React from 'react';
import type { ReviewCounts } from '../../utils/screeningView';
import type { ScreeningChange } from './useScreening';

/**
 * The counts bar: how many articles each kind holds and how many are still undecided. Kinds read by their word,
 * not by colour alone.
 *
 * @example <ReviewCountsBar counts={view.counts} />
 */
export const ReviewCountsBar: React.FC<{ counts: ReviewCounts }> = ({ counts }) => (
  <div className="review-counts" role="status" aria-label="Contagem da triagem">
    <span className="review-chip review-chip--include">{counts.include} incluídos</span>
    <span className="review-chip review-chip--maybe">{counts.maybe} em dúvida</span>
    <span className="review-chip review-chip--exclude">{counts.exclude} excluídos</span>
    <span className="review-chip review-chip--removed">{counts.removed} removidos antes da triagem</span>
    <span className="review-chip review-chip--none">{counts.pending} sem decisão</span>
    {counts.unlabeled > 0 && (
      <span className="review-chip review-chip--none">{counts.unlabeled} arquivados sem rótulo</span>
    )}
    <span style={{ flex: 1 }} />
    <span className="review-muted">Excluir aqui também arquiva o artigo no projeto, com o rótulo como motivo.</span>
  </div>
);

/**
 * The toast after each decision, with "Desfazer".
 *
 * @example {lastChange && <UndoToast change={lastChange} />}
 */
export const UndoToast: React.FC<{ change: ScreeningChange }> = ({ change }) => (
  <div className="review-toast" role="status">
    <span>{change.text}</span>
    <button type="button" onClick={() => void change.undo()}>
      Desfazer
    </button>
  </div>
);
