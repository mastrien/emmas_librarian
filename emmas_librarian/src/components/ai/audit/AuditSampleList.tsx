import React from 'react';
import type { Article, InvestigationResult } from '../../../types';
import { REVIEW_CHIP } from './auditLabels';

interface AuditSampleListProps {
  /** The drawn items in review order. */
  sampled: InvestigationResult[];
  questionNumberOf: (result: InvestigationResult) => number | undefined;
  articles: Article[];
  currentId: number | null;
  onSelect: (resultId: number) => void;
}

const titleOf = (articles: Article[], id: number) => articles.find((a) => a.id === id)?.title ?? `Artigo ${id}`;

/**
 * The left column of the audit (board 163): every drawn item, by question and article, with its mark. Picking one
 * shows it in the middle.
 *
 * @example <AuditSampleList sampled={sampled} questionNumberOf={q} articles={as} currentId={id} onSelect={select} />
 */
export const AuditSampleList: React.FC<AuditSampleListProps> = (props) => {
  const { sampled, questionNumberOf, articles, currentId, onSelect } = props;
  const marked = sampled.filter((r) => r.review_status !== 'pending').length;
  return (
    <nav className="audit-sample" aria-label="Amostra">
      <div className="audit-sample-head">
        <span className="audit-eyebrow">Amostra</span>
        <span className="audit-muted audit-num audit-text-xs">
          {marked} de {sampled.length} marcados
        </span>
      </div>
      <ul className="audit-sample-list">
        {sampled.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`audit-sample-item${r.id === currentId ? ' is-current' : ''}`}
              aria-current={r.id === currentId ? 'true' : undefined}
              onClick={() => onSelect(r.id)}
            >
              <span className="audit-qnum">P{questionNumberOf(r)}</span>
              <span className="audit-sample-title">{titleOf(articles, r.article_id)}</span>
              <span className={`audit-mark audit-mark--${REVIEW_CHIP[r.review_status].className}`}>
                {REVIEW_CHIP[r.review_status].label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
