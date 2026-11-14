import React from 'react';
import { NavLink } from 'react-router-dom';
import type { InvestigationHistoryRecord } from '../../types';
import { parseJsonList } from '../../utils/parseJsonList';
import { investigationPath } from './investigationView';
import type { InvestigationRunState } from './useInvestigationRun';

/**
 * How far a run got, in whole percent: the article being asked counts as not done yet.
 *
 * @example runPercent({ current: 4, targets: [a, b, c, d, e, f, g, h, i] }) // 33
 */
export function runPercent(run: Pick<InvestigationRunState, 'current' | 'targets'>): number {
  if (!run.targets.length) return 0;
  return Math.round((100 * Math.max(run.current - 1, 0)) / run.targets.length);
}

/**
 * What the short sidebar line leaves out, for its tooltip: status, model, size, review and audit.
 *
 * @example savedDetails(record, 3, true) // "Sucesso · Ollama (gpt-oss) · 9 artigos · 4 perguntas · 3 para revisar · auditada"
 */
export function savedDetails(
  record: InvestigationHistoryRecord,
  pending: number | undefined,
  audited: boolean,
): string {
  const parts = [
    record.status || 'Status desconhecido',
    record.model_used || 'Modelo desconhecido',
    `${parseJsonList(record.articles_ids).length} artigos`,
    `${parseJsonList(record.questions).length} perguntas`,
  ];
  if (pending) parts.push(`${pending} para revisar`);
  if (audited) parts.push('auditada');
  return parts.join(' · ');
}

const subClass = ({ isActive }: { isActive: boolean }) => `project-nav__sub${isActive ? ' is-active' : ''}`;

const RunningItem: React.FC<{ projectId: number; run: InvestigationRunState; onPick: () => void }> = ({
  projectId,
  run,
  onPick,
}) => (
  <NavLink
    to={investigationPath(projectId, 'running')}
    className={subClass}
    onClick={onPick}
    title={`Artigo ${run.current} de ${run.targets.length} · ${run.questions.length} perguntas`}
  >
    <span className="project-nav__sub-dot" aria-hidden="true" />
    <span className="project-nav__sub-label">Em andamento</span>{' '}
    <span className="project-nav__sub-count">{runPercent(run)}%</span>
  </NavLink>
);

const SavedItem: React.FC<{
  projectId: number;
  record: InvestigationHistoryRecord;
  pending?: number;
  audited: boolean;
  onPick: () => void;
}> = ({ projectId, record, pending, audited, onPick }) => (
  <NavLink
    to={investigationPath(projectId, record.id)}
    className={subClass}
    onClick={onPick}
    title={savedDetails(record, pending, audited)}
  >
    <span className="project-nav__sub-label">
      #{record.id} · {new Date(record.created_at).toLocaleDateString('pt-BR')}
    </span>
    {/* The count is what is left to review, as on the canvas; the space keeps "#2 · 08/08/202636" apart. */}
    {!!pending && (
      <>
        {' '}
        <span className="project-nav__sub-count" aria-label={`${pending} para revisar`}>
          {pending}
        </span>
      </>
    )}
  </NavLink>
);

interface InvestigationNavListProps {
  projectId: number;
  history: InvestigationHistoryRecord[];
  run: InvestigationRunState | null;
  pendingById: Record<number, number>;
  auditedIds: number[];
  /** Called when an investigation is chosen, so a drawer can close. */
  onPick: () => void;
}

/**
 * The project's investigations under "Investigação com IA" in the project sidebar (board 159): a new one, the one
 * running, then the stored ones with what is left to review. In a drawer on a folded sidebar.
 *
 * @example <InvestigationNavList projectId={3} history={h} run={null} pendingById={{}} auditedIds={[]} onPick={close} />
 */
export const InvestigationNavList: React.FC<InvestigationNavListProps> = (props) => {
  const { projectId, history, run, pendingById, auditedIds, onPick } = props;
  const running = run?.isRunning && run.projectId === projectId ? run : null;
  return (
    <nav className="project-nav__sub-list" aria-label="Investigações do projeto">
      <NavLink to={investigationPath(projectId, 'new')} className={subClass} onClick={onPick}>
        <span className="project-nav__sub-label">+ Nova investigação</span>
      </NavLink>
      {running && <RunningItem projectId={projectId} run={running} onPick={onPick} />}
      {history.map((record) => (
        <SavedItem
          key={record.id}
          projectId={projectId}
          record={record}
          pending={pendingById[record.id]}
          audited={auditedIds.includes(record.id)}
          onPick={onPick}
        />
      ))}
      {!running && history.length === 0 && <span className="project-nav__sub-empty">Nenhuma investigação ainda.</span>}
    </nav>
  );
};
