import React from 'react';
import type { Article } from '../../../types';
import type { AuditQuestionRow } from '../../../utils/auditQuestions';
import { finalAnswerText } from '../../../utils/investigationAnswers';
import { AxisScale, ForestPlot, RateText } from './ForestPlot';
import { REVIEW_CHIP } from './auditLabels';

export interface AuditQuestionTableProps {
  rows: AuditQuestionRow[];
  articles: Article[];
  open: Set<number>;
  selectedId: number | null;
  onToggle: (questionNumber: number) => void;
  onSelect: (resultId: number) => void;
}

const titleOf = (articles: Article[], id: number) => articles.find((a) => a.id === id)?.title ?? `Artigo ${id}`;

/**
 * One row per question (P1, P2...): answers that came back, how many drawn items are marked, the accuracy and its
 * interval on the shared axis. A question opens to list its drawn items; picking one shows it in the side panel.
 *
 * Usage:
 *   <AuditQuestionTable rows={rows} articles={articles} open={open} selectedId={id} onToggle={toggle} onSelect={select} />
 */
export const AuditQuestionTable: React.FC<AuditQuestionTableProps> = (props) => {
  const { rows, articles, open, selectedId, onToggle, onSelect } = props;
  return (
    <div className="audit-panel" style={{ overflowX: 'auto' }}>
      <table className="audit-table">
        <thead>
          <tr>
            <th>Pergunta</th>
            <th className="right">Respostas</th>
            <th className="right">Marcados</th>
            <th>Acerto</th>
            <th style={{ width: '30%' }}>IC 95%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <React.Fragment key={row.number}>
              <QuestionRow row={row} isOpen={open.has(row.number)} onToggle={onToggle} />
              {open.has(row.number) && row.answered > 0 && (
                <tr className="audit-items">
                  <td colSpan={5}>
                    {row.sampled.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`audit-item${selectedId === r.id ? ' selected' : ''}`}
                        onClick={() => onSelect(r.id)}
                      >
                        <span className="audit-item-article">{titleOf(articles, r.article_id)}</span>
                        <span className="audit-item-answer">{finalAnswerText(r) || '—'}</span>
                        <span className={`audit-chip ${REVIEW_CHIP[r.review_status].className}`}>
                          {REVIEW_CHIP[r.review_status].label}
                        </span>
                      </button>
                    ))}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          <tr>
            <td colSpan={4} style={{ borderBottom: 'none' }} />
            <td style={{ borderBottom: 'none', paddingTop: 4 }}>
              <AxisScale />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const QuestionRow: React.FC<{ row: AuditQuestionRow; isOpen: boolean; onToggle: (n: number) => void }> = ({
  row,
  isOpen,
  onToggle,
}) => {
  const nothing = row.answered === 0;
  return (
    <tr
      className={nothing ? undefined : `audit-q${isOpen ? ' open' : ''}`}
      onClick={nothing ? undefined : () => onToggle(row.number)}
      aria-expanded={nothing ? undefined : isOpen}
    >
      <td>
        <div className="audit-qcell">
          <span className="audit-qnum">P{row.number}</span>
          <span className="audit-qtext">{row.question}</span>
        </div>
      </td>
      <td className="right audit-num">
        {row.answered}
        {row.failed > 0 && (
          <div className="audit-muted" style={{ fontSize: '0.75rem' }}>
            +{row.failed} com erro
          </div>
        )}
      </td>
      <td className="right audit-num">
        {nothing ? (
          <span className="audit-chip none">nada a auditar</span>
        ) : (
          `${row.stats.marked}/${row.sampled.length}`
        )}
      </td>
      <td>{!nothing && <RateText interval={row.stats.interval} />}</td>
      <td>{!nothing && <ForestPlot interval={row.stats.interval} />}</td>
    </tr>
  );
};
