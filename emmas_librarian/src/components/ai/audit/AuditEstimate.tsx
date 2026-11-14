import React from 'react';
import type { AuditStats } from '../../../utils/auditSampling';
import { percent } from '../../../utils/auditQuestions';
import { AxisScale, ForestPlot } from './ForestPlot';
import { AuditHelpButton } from './AuditHelpDialog';

interface AuditEstimateProps {
  stats: AuditStats;
  onHelp: () => void;
}

/**
 * The number the audit exists for (board 163, top of the right column): the estimated accuracy over the whole
 * sample, how many marks were correct, the interval on the axis and in words.
 *
 * Usage:
 *   <AuditEstimate stats={auditStats(sampledInOrder(rows))} onHelp={openHelp} />
 */
export const AuditEstimate: React.FC<AuditEstimateProps> = ({ stats, onHelp }) => {
  const { interval, marked, correct } = stats;
  return (
    <section className="audit-panel audit-estimate" aria-label="Acerto estimado">
      <div className="audit-row audit-gap-6">
        <span className="audit-eyebrow">Acerto estimado</span>
        <AuditHelpButton onClick={onHelp} label="O que é o acerto estimado e o IC 95%" />
      </div>
      <div className="audit-row audit-baseline">
        <span className="audit-big audit-num">{interval ? percent(interval.estimate) : '—'}</span>
        {interval && (
          <span className="audit-muted audit-num audit-text-sm">
            {correct} de {marked} corretas
          </span>
        )}
      </div>
      <ForestPlot interval={interval} />
      <AxisScale />
      <span className="audit-muted audit-text-sm">
        {interval
          ? `IC 95% de ${percent(interval.low)} a ${percent(interval.high)} (Wilson). Corrigida e incorreta contam como erro.`
          : 'Marque itens da amostra para ver a estimativa.'}
      </span>
    </section>
  );
};
