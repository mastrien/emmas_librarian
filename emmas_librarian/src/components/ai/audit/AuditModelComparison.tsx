import React from 'react';
import type { ModelAuditRow } from '../../../utils/auditModels';
import { AxisScale, ForestPlot, RateText } from './ForestPlot';
import { AuditHelpButton } from './AuditHelpDialog';

interface AuditModelComparisonProps {
  rows: ModelAuditRow[];
  currentId: number;
  onHelp: () => void;
}

/**
 * Side-by-side accuracy per model on the shared axis; overlapping intervals mean the samples do not tell the models
 * apart.
 *
 * Usage:
 *   <AuditModelComparison rows={rows} currentId={investigation.id} onHelp={openHelp} />
 */
export const AuditModelComparison: React.FC<AuditModelComparisonProps> = ({ rows, currentId, onHelp }) => (
  <section className="audit-panel" aria-label="Comparação por modelo">
    <div className="audit-row audit-spread audit-compare-head">
      <div className="audit-row audit-gap-6">
        <h3 className="audit-m0">Comparação por modelo</h3>
        <AuditHelpButton onClick={onHelp} label="Como ler os intervalos" />
      </div>
      <span className="audit-muted audit-text-xs">investigações auditadas deste projeto</span>
    </div>
    {rows.length < 2 ? (
      <p className="audit-muted audit-compare-note">
        Audite outra investigação deste projeto, de outro modelo, para comparar aqui.
      </p>
    ) : (
      <div className="audit-scroll-x">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Modelo</th>
              <th className="right">Marcados</th>
              <th>Acerto</th>
              <th className="audit-col-40">IC 95%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.investigationId}>
                <td className={`audit-model-cell${row.investigationId === currentId ? ' is-current' : ''}`}>
                  {row.model} <span className="audit-muted">#{row.investigationId}</span>
                </td>
                <td className="right audit-num">
                  {row.stats.marked}/{row.stats.sampled}
                </td>
                <td>
                  <RateText interval={row.stats.interval} />
                </td>
                <td>
                  <ForestPlot interval={row.stats.interval} />
                </td>
              </tr>
            ))}
            <tr>
              <td className="audit-no-rule" colSpan={3} />
              <td className="audit-no-rule audit-axis-cell">
                <AxisScale />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="audit-muted audit-compare-note audit-text-xs">
          Intervalos que se sobrepõem não mostram diferença clara entre os modelos.
        </p>
      </div>
    )}
  </section>
);
