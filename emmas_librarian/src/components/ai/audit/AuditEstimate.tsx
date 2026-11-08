import React from 'react';
import type { AuditStats } from '../../../utils/auditSampling';
import { percent } from '../../../utils/auditQuestions';
import { AxisScale, ForestPlot } from './ForestPlot';
import { AuditHelpButton } from './AuditHelpDialog';

interface AuditEstimateProps {
  stats: AuditStats;
  onReviewInSequence: () => void;
  onHelp: () => void;
}

/**
 * The number the audit exists for: the estimated accuracy over the whole sample, its interval in words and on the
 * axis, how much of the sample is marked, and the way into the review queue.
 *
 * Usage:
 *   <AuditEstimate stats={auditStats(sampledInOrder(rows))} onReviewInSequence={openQueue} onHelp={openHelp} />
 */
export const AuditEstimate: React.FC<AuditEstimateProps> = ({ stats, onReviewInSequence, onHelp }) => {
  const { interval, marked, sampled, correct } = stats;
  return (
    <section className="audit-panel audit-estimate" aria-label="Acerto estimado">
      <div>
        <div className="audit-row audit-gap-6">
          <span className="audit-eyebrow">Acerto estimado</span>
          <AuditHelpButton onClick={onHelp} label="O que é o acerto estimado e o IC 95%" />
        </div>
        <div className="audit-big audit-num">{interval ? percent(interval.estimate) : '—'}</div>
      </div>
      <div className="audit-stack-6">
        <span className="audit-muted audit-text-sm">
          {interval
            ? `IC 95%: ${percent(interval.low)} a ${percent(interval.high)} · ${correct} de ${marked} corretos`
            : 'Marque itens da amostra para ver a estimativa'}
        </span>
        <ForestPlot interval={interval} />
        <AxisScale />
      </div>
      <div className="audit-done">
        <span className="audit-num audit-text-md">
          <b>{marked}</b> de {sampled} marcados
        </span>
        <div className="audit-bar" role="progressbar" aria-valuemin={0} aria-valuemax={sampled} aria-valuenow={marked}>
          <span style={{ '--progress': `${sampled ? (marked / sampled) * 100 : 0}%` } as React.CSSProperties} />
        </div>
        <button type="button" className="btn-primary" disabled={marked >= sampled} onClick={onReviewInSequence}>
          Revisar em sequência
        </button>
      </div>
    </section>
  );
};
