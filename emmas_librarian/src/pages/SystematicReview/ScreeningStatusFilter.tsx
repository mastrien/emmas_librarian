import React from 'react';
import { Check, CircleHelp, Minus, X } from 'lucide-react';
import type { ReviewCounts } from '../../utils/screeningView';
import { SCREENING_FILTERS, filterCount, type ScreeningFilter } from './screeningFilter';

const ICONS: Partial<Record<ScreeningFilter, React.ReactNode>> = {
  include: <Check size={14} className="review-icon--include" aria-hidden="true" />,
  maybe: <CircleHelp size={14} className="review-icon--maybe" aria-hidden="true" />,
  exclude: <X size={14} className="review-icon--exclude" aria-hidden="true" />,
  removed: <Minus size={14} className="review-icon--removed" aria-hidden="true" />,
};

/**
 * The statuses of the screening as one segmented control with their counts (board 164); the list shows the chosen
 * one. A line for screen readers keeps announcing every count after each decision, as the old counts bar did.
 *
 * @example <ScreeningStatusFilter counts={view.counts} value="pending" onChange={setFilter} />
 */
export const ScreeningStatusFilter: React.FC<{
  counts: ReviewCounts;
  value: ScreeningFilter;
  onChange: (filter: ScreeningFilter) => void;
}> = ({ counts, value, onChange }) => (
  <>
    <div className="review-status-filter" role="group" aria-label="Status da triagem">
      {SCREENING_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          className={`review-status${value === f.id ? ' is-on' : ''}`}
          onClick={() => onChange(f.id)}
        >
          {ICONS[f.id]}
          {f.label} <span className="review-status__count">{filterCount(counts, f.id)}</span>
        </button>
      ))}
    </div>
    <span className="visually-hidden" role="status" aria-label="Contagem da triagem">
      {counts.include} incluídos · {counts.maybe} em dúvida · {counts.exclude} excluídos · {counts.removed} removidos
      antes da triagem · {counts.pending} sem decisão
      {counts.unlabeled > 0 && ` · ${counts.unlabeled} arquivados sem rótulo`}
    </span>
  </>
);
