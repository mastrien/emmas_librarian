import React from 'react';
import { AlertCircle, Check, Minus } from 'lucide-react';
import { callMatrix, type CallCell, type CallStatus } from './investigationView';

export const CALL_STATUS_NAMES: Record<CallStatus, string> = {
  success: 'com resposta',
  error: 'erro',
  skipped: 'pulada',
  running: 'rodando',
  queued: 'na fila',
};

const STATUS_ICON: Partial<Record<CallStatus, React.ReactNode>> = {
  success: <Check size={12} />,
  error: <AlertCircle size={12} />,
  skipped: <Minus size={12} />,
};

const MatrixCell: React.FC<{ call?: CallCell }> = ({ call }) => {
  if (!call) return <td className="inv-matrix__cell" />;
  const name = `${call.articleTitle}, ${call.question}: ${CALL_STATUS_NAMES[call.status]}`;
  return (
    <td className="inv-matrix__cell">
      <span role="img" aria-label={name} title={call.error ?? name} className={`inv-mark inv-mark--${call.status}`}>
        {STATUS_ICON[call.status]}
      </span>
    </td>
  );
};

/**
 * Every call of an investigation as articles × questions (board 160): a check when it answered, a mark when it
 * failed, a ring on the one running and an empty square for those in the queue.
 *
 * @example <CallMatrix cells={liveCalls(run)} questions={run.questions} />
 */
export const CallMatrix: React.FC<{ cells: CallCell[]; questions: string[] }> = ({ cells, questions }) => (
  <section className="inv-card inv-matrix" aria-label="Cada chamada">
    <table className="inv-matrix__table">
      <thead>
        <tr>
          <th scope="col">Artigo</th>
          {questions.map((q, i) => (
            <th key={q} scope="col" className="inv-matrix__q" title={q}>
              P{i + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {callMatrix(cells, questions).map((row) => (
          <tr key={row.articleId}>
            <th scope="row" className="inv-matrix__title" title={row.articleTitle}>
              {row.articleTitle}
            </th>
            {row.calls.map((call, i) => (
              <MatrixCell key={i} call={call} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
