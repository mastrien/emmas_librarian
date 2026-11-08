import React from 'react';
import { ChevronsLeft } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { InvestigationHistoryRecord } from '../../types';
import { statusTone } from '../../utils/investigationStatus';
import { parseJsonList } from '../../utils/parseJsonList';
import { investigationPath } from './investigationView';
import type { InvestigationRunState } from './useInvestigationRun';

const CHIP = { success: 'inv-chip--ok', warning: 'inv-chip--warn', danger: 'inv-chip--bad' };

const RunningCard: React.FC<{ projectId: number; run: InvestigationRunState; onPick: () => void }> = ({
  projectId,
  run,
  onPick,
}) => {
  const percent = run.targets.length ? (100 * Math.max(run.current - 1, 0)) / run.targets.length : 0;
  return (
    <NavLink to={investigationPath(projectId, 'running')} className="inv-list-item" onClick={onPick}>
      <span className="inv-list-top">
        <strong>Em andamento</strong>
        <span className="inv-chip inv-chip--run">
          Artigo {run.current} de {run.targets.length}
        </span>
      </span>
      <span className="inv-bar" aria-hidden="true">
        <i style={{ '--progress': `${percent}%` } as React.CSSProperties} />
      </span>
      <span className="inv-muted">
        {run.targets.length} artigos · {run.questions.length} perguntas
      </span>
    </NavLink>
  );
};

const pendingLine = (pending: number | undefined, audited: boolean) => {
  const parts = [];
  if (pending) parts.push(`${pending} para revisar`);
  if (audited) parts.push('auditada');
  return parts.join(' · ');
};

const SavedCard: React.FC<{
  projectId: number;
  record: InvestigationHistoryRecord;
  pending?: number;
  audited: boolean;
  onPick: () => void;
}> = ({ projectId, record, pending, audited, onPick }) => (
  <NavLink to={investigationPath(projectId, record.id)} className="inv-list-item" onClick={onPick}>
    <span className="inv-list-top">
      <strong>
        #{record.id} · {new Date(record.created_at).toLocaleDateString()}
      </strong>
      {record.status && <span className={`inv-chip ${CHIP[statusTone(record.status)]}`}>{record.status}</span>}
    </span>
    <span className="inv-muted">
      {record.model_used || 'Modelo desconhecido'} · {parseJsonList(record.articles_ids).length} artigos ·{' '}
      {parseJsonList(record.questions).length} perguntas
    </span>
    {pendingLine(pending, audited) && <span className="inv-muted">{pendingLine(pending, audited)}</span>}
  </NavLink>
);

interface InvestigationSidebarProps {
  projectId: number;
  history: InvestigationHistoryRecord[];
  run: InvestigationRunState | null;
  pendingById: Record<number, number>;
  auditedIds: number[];
  /** Beside the content: a way to collapse the list. In a drawer the drawer has its own X. */
  onCollapse?: () => void;
  /** Called when an investigation is chosen, so a drawer can close. */
  onPick: () => void;
}

/**
 * The project's investigations, the running one first. Picking one opens it on the page.
 *
 * @example <InvestigationSidebar projectId={3} history={h} run={null} pendingById={{}} auditedIds={[]} onPick={close} />
 */
export const InvestigationSidebar: React.FC<InvestigationSidebarProps> = (props) => {
  const { projectId, history, run, pendingById, auditedIds, onCollapse, onPick } = props;
  const running = run?.isRunning && run.projectId === projectId ? run : null;
  return (
    <nav className="inv-sidebar" aria-label="Investigações do projeto">
      <div className="inv-sidebar-head">
        <h3 className="inv-section-title">Investigações</h3>
        {onCollapse && (
          <button
            type="button"
            className="inv-icon"
            aria-label="Recolher a lista de investigações"
            onClick={onCollapse}
          >
            <ChevronsLeft size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="inv-list">
        {running && <RunningCard projectId={projectId} run={running} onPick={onPick} />}
        {history.map((record) => (
          <SavedCard
            key={record.id}
            projectId={projectId}
            record={record}
            pending={pendingById[record.id]}
            audited={auditedIds.includes(record.id)}
            onPick={onPick}
          />
        ))}
        {!running && history.length === 0 && <div className="inv-empty">Nenhuma investigação ainda.</div>}
      </div>
    </nav>
  );
};
