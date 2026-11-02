import React from 'react';
import { callErrorGroups, type CallCell, type CallStatus } from './investigationView';

interface CallsTabProps {
  cells: CallCell[];
  questions: string[];
  /** Runs the articles of a failed group again, in a new investigation. Absent while running. */
  onRedo?: (articleIds: number[]) => void;
}

const STATUS_NAMES: Record<CallStatus, string> = {
  success: 'com resposta',
  error: 'erro',
  skipped: 'pulada',
  running: 'rodando',
  queued: 'na fila',
};

const LEGEND_ORDER: CallStatus[] = ['success', 'error', 'skipped', 'running', 'queued'];

const isDone = (cell: CallCell) => cell.status !== 'running' && cell.status !== 'queued';

const Stat: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => (
  <div className="inv-stat">
    <span className="inv-muted">{label}</span>
    <strong style={danger ? { color: 'var(--color-danger)' } : undefined}>{value}</strong>
  </div>
);

const CallGrid: React.FC<{ cells: CallCell[]; questions: string[] }> = ({ cells, questions }) => (
  <section className="inv-card" aria-label="Cada chamada">
    <h3 className="inv-section-title">Cada chamada (artigo × pergunta)</h3>
    <div className="inv-call-grid" style={{ gridTemplateColumns: `repeat(${Math.max(questions.length, 1)}, 1fr)` }}>
      {cells.map((cell, i) => (
        <span
          key={i}
          role="img"
          className={`inv-call inv-call--${cell.status}`}
          title={`${cell.articleTitle} · ${cell.question}: ${STATUS_NAMES[cell.status]}`}
          aria-label={`${cell.articleTitle}, ${cell.question}: ${STATUS_NAMES[cell.status]}`}
        />
      ))}
    </div>
    <div className="inv-legend">
      {LEGEND_ORDER.map((status) => (
        <span key={status}>
          <i className={`inv-dot inv-call--${status}`} />
          {STATUS_NAMES[status]}
        </span>
      ))}
    </div>
  </section>
);

/**
 * The "Chamadas" tab: how far the investigation went, its errors grouped by message with a way to run those
 * articles again, and one square per article × question. Serves a stored investigation and the one running.
 *
 * @example <CallsTab cells={savedCalls(results, articles)} questions={questions} onRedo={redo} />
 */
export const CallsTab: React.FC<CallsTabProps> = ({ cells, questions, onRedo }) => {
  const done = cells.filter(isDone).length;
  const answered = cells.filter((c) => c.status === 'success').length;
  const groups = callErrorGroups(cells);
  const failed = groups.reduce((sum, g) => sum + g.count, 0);
  return (
    <div className="inv-scroll inv-stack">
      <div className="inv-stats">
        <Stat label="Chamadas feitas" value={`${done} de ${cells.length}`} />
        <Stat label="Com resposta" value={String(answered)} />
        <Stat label="Com erro" value={String(failed)} danger={failed > 0} />
      </div>
      {groups.map((group) => (
        <div key={`${group.status}:${group.message}`} role="alert" className="inv-error-group">
          <div style={{ minWidth: 0 }}>
            <strong>
              {group.count} {group.count === 1 ? 'chamada' : 'chamadas'}{' '}
              {group.status === 'error' ? 'com erro' : 'pulada(s)'}
            </strong>
            <div className="inv-muted" style={{ overflowWrap: 'anywhere' }}>
              {group.message}
            </div>
          </div>
          {onRedo && (
            <button type="button" className="btn-secondary inv-small" onClick={() => onRedo(group.articleIds)}>
              Refazer {group.articleIds.length === 1 ? 'este artigo' : `estes ${group.articleIds.length} artigos`}
            </button>
          )}
        </div>
      ))}
      <CallGrid cells={cells} questions={questions} />
      <section className="inv-card" aria-label="Perguntas">
        <h3 className="inv-section-title">Perguntas</h3>
        <ol className="inv-question-list">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>
    </div>
  );
};
