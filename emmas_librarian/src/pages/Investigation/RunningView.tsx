import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { CallMatrix } from './CallMatrix';
import { callErrorGroups, liveCalls, type CallCell } from './investigationView';
import type { InvestigationRunState } from './useInvestigationRun';
import './investigationRuns.css';

/**
 * Minutes and seconds since a start, for "02:41 decorridos"; hours only when there are any.
 *
 * @example formatElapsed(161_000) // '02:41'; formatElapsed(3_725_000) // '1:02:05'
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** The time since `startedAt`, ticking every second while mounted. */
function useElapsed(startedAt: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return formatElapsed(now - startedAt);
}

const isDone = (cell: CallCell) => cell.status !== 'running' && cell.status !== 'queued';

const ProgressCard: React.FC<{ run: InvestigationRunState; cells: CallCell[] }> = ({ run, cells }) => {
  const done = cells.filter(isDone).length;
  const elapsed = useElapsed(run.startedAt);
  const now = run.targets[run.current - 1];
  return (
    <section className="inv-card inv-progress" aria-label="Progresso">
      <div className="inv-progress__head">
        <span className="inv-progress__title">Perguntando aos PDFs</span>
        <span className="inv-progress__count">
          {done} de {cells.length} chamadas
        </span>
      </div>
      <progress className="inv-progress__bar" max={cells.length || 1} value={done} aria-label="Chamadas feitas" />
      <div className="inv-progress__foot inv-muted">
        {now && (
          <span className="inv-shrink">
            Agora: <strong>{now.title}</strong>
          </span>
        )}
        <span className="inv-progress__time">{elapsed} decorridos</span>
      </div>
    </section>
  );
};

const STAGE_MARK = { done: <Check size={12} />, run: null, wait: null };

/**
 * How far the indexing of the PDFs is. The run indexes each PDF the first time it asks about it, so an article that
 * already has its results has certainly been indexed; the stage is done only when every article has.
 *
 * @example indexStage({ targets: [a, b], results: [r] }) // { state: 'run', note: '1 de 2' }
 */
export function indexStage(run: Pick<InvestigationRunState, 'targets' | 'results'>): {
  state: 'done' | 'run';
  note: string;
} {
  const total = run.targets.length;
  const indexed = Math.min(run.results.length, total);
  return { state: indexed === total ? 'done' : 'run', note: `${indexed} de ${total}` };
}

/** "Iniciada às 22:05": when the run began, in the user's clock. */
export function startedAtText(startedAt: number): string {
  const time = new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Iniciada às ${time}`;
}

const Stage: React.FC<{ state: 'done' | 'run' | 'wait'; label: string; note: string }> = ({ state, label, note }) => (
  <li className={`inv-stage inv-stage--${state}`}>
    <span className="inv-stage__mark" aria-hidden="true">
      {STAGE_MARK[state]}
    </span>
    <span className="inv-stage__label">{label}</span>
    <span className="inv-muted">{note}</span>
  </li>
);

const RunSide: React.FC<{ cells: CallCell[]; run: InvestigationRunState }> = ({ cells, run }) => {
  const done = cells.filter(isDone).length;
  const indexing = indexStage(run);
  const groups = callErrorGroups(cells).filter((g) => g.status === 'error');
  return (
    <div className="inv-run-side">
      <section className="inv-card" aria-label="Etapas">
        <h3 className="inv-section-title">Etapas</h3>
        <ol className="inv-stages">
          <Stage state={indexing.state} label="Indexar os PDFs" note={indexing.note} />
          <Stage state="run" label="Perguntar a cada PDF" note={`${done} de ${cells.length}`} />
          <Stage state="wait" label="Revisar as respostas" note="você" />
        </ol>
      </section>
      {/* One line per message: a wrong key fails every call the same way (validation of #44). */}
      {groups.map((group) => (
        <div key={group.message} className="inv-callout inv-callout--bad" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span className="inv-shrink">
            <strong>
              {group.count} {group.count === 1 ? 'chamada falhou' : 'chamadas falharam'}
            </strong>
            <span className="inv-muted inv-wrap-anywhere"> {group.message}</span>
          </span>
        </div>
      ))}
      <div className="inv-callout">
        <Info size={16} aria-hidden="true" />
        <span>Pode sair desta tela. A investigação segue, e a barra lateral mostra o andamento.</span>
      </div>
    </div>
  );
};

interface RunningViewProps {
  run: InvestigationRunState;
  modelLabel: string;
  onCancel: () => void;
  /** Leaves the screen while the run goes on. */
  onLeave: () => void;
}

/**
 * The investigation while it runs (board 160): how many calls are done and which article is being asked, every
 * call as articles × questions, and on the side the stages and what failed so far.
 *
 * @example <RunningView run={run} modelLabel="Ollama" onCancel={cancel} onLeave={() => navigate(articles)} />
 */
export const RunningView: React.FC<RunningViewProps> = ({ run, modelLabel, onCancel, onLeave }) => {
  const cells = liveCalls(run);
  return (
    <>
      <PageHeader
        title={
          <>
            Investigação <span className="inv-badge-run">Rodando</span>
          </>
        }
        subtitle={`${startedAtText(run.startedAt)} · ${modelLabel} · ${run.targets.length} artigos · ${run.questions.length} perguntas`}
        actions={
          <>
            <button type="button" className="btn-ghost inv-danger" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onLeave}>
              Continuar em segundo plano
            </button>
          </>
        }
      />
      <div className="inv-scroll inv-run-layout">
        <div className="inv-run-main">
          <ProgressCard run={run} cells={cells} />
          <CallMatrix cells={cells} questions={run.questions} />
        </div>
        <RunSide cells={cells} run={run} />
      </div>
    </>
  );
};
