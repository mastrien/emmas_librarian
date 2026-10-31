import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { ReviewRow } from '../../utils/screeningView';
import { articleMeta, wasRead } from './reviewText';

interface ReviewArticleRowProps {
  row: ReviewRow;
  actions: React.ReactNode;
  /** Inside a section or group: indented so the hierarchy section → group → article reads at a glance. */
  nested?: 'section' | 'group';
  reason?: string;
  selection?: { checked: boolean; onToggle: () => void };
}

/**
 * One article on the review page: title, authors · year · journal, the "lido" badge from the project page, an
 * optional reason (exclusions) and the row's buttons, with "Ver" opening the PDF reader.
 *
 * @example <ReviewArticleRow row={row} nested="section" actions={<LabelMenu … />} />
 */
export const ReviewArticleRow: React.FC<ReviewArticleRowProps> = ({ row, actions, nested, reason, selection }) => {
  const classes = ['review-row', nested && 'review-row--indent', nested === 'group' && 'review-row--grouped'];
  return (
    <div className={classes.filter(Boolean).join(' ')} data-testid="review-row">
      {selection && (
        <input
          type="checkbox"
          className="review-row-check"
          checked={selection.checked}
          onChange={selection.onToggle}
          aria-label={`Selecionar ${row.article.title}`}
        />
      )}
      <div className="review-row-text">
        <span className="review-row-title">{row.article.title}</span>
        <span className="review-row-meta">{articleMeta(row.article)}</span>
        {reason && <span className="review-row-reason">{reason}</span>}
        {wasRead(row) && (
          <span className="review-chip review-chip--read" style={{ alignSelf: 'flex-start' }}>
            <Check size={12} aria-hidden="true" /> lido
          </span>
        )}
      </div>
      <div className="review-row-actions">
        <Link to={`/articles/${row.article.id}`} className="review-small">
          Ver
        </Link>
        {actions}
      </div>
    </div>
  );
};
