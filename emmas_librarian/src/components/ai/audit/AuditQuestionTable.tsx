import React from 'react';
import type { AuditQuestionRow } from '../../../utils/auditQuestions';
import { ForestPlot, RateText } from './ForestPlot';

export interface AuditQuestionTableProps {
  rows: AuditQuestionRow[];
}

/**
 * "Por pergunta" in the audit's right column (board 163): one row per question (P1, P2...) with the answers that
 * came back, how many drawn items are marked, the accuracy and its interval on the shared axis. The drawn items
 * themselves are in the sample list on the left.
 *
 * Usage:
 *   <AuditQuestionTable rows={rows} />
 */
export const AuditQuestionTable: React.FC<AuditQuestionTableProps> = ({ rows }) => (
  <section className="audit-panel audit-scroll-x" aria-label="Por pergunta">
    <h3 className="audit-section-title">Por pergunta</h3>
    <table className="audit-table">
      <thead>
        <tr>
          <th>Pergunta</th>
          <th className="right">Marcados</th>
          <th className="right">Acerto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <QuestionRow key={row.number} row={row} />
        ))}
      </tbody>
    </table>
  </section>
);

// Three columns fit the right column of the audit (board 163): how many answers came back goes under the question.
const QuestionRow: React.FC<{ row: AuditQuestionRow }> = ({ row }) => {
  const nothing = row.answered === 0;
  return (
    <>
      <tr className="audit-q">
        <td>
          <div className="audit-qcell" title={row.question}>
            <span className="audit-qnum">P{row.number}</span>
            <span className="audit-qtext">{row.question}</span>
          </div>
          <div className="audit-muted audit-text-xs audit-num">
            {row.answered} {row.answered === 1 ? 'resposta' : 'respostas'}
            {row.failed > 0 && ` · +${row.failed} com erro`}
          </div>
        </td>
        <td className="right audit-num">
          {nothing ? (
            <span className="audit-chip none">nada a auditar</span>
          ) : (
            `${row.stats.marked}/${row.sampled.length}`
          )}
        </td>
        <td className="right">{!nothing && <RateText interval={row.stats.interval} />}</td>
      </tr>
      {!nothing && (
        <tr className="audit-q-plot">
          <td colSpan={3}>
            <ForestPlot interval={row.stats.interval} />
          </td>
        </tr>
      )}
    </>
  );
};
