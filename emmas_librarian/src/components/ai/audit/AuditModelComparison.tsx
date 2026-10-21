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
    <div className="audit-row audit-spread" style={{ padding: '14px 16px 6px' }}>
      <div className="audit-row" style={{ gap: 6 }}>
        <h3 style={{ margin: 0 }}>Comparação por modelo</h3>
        <AuditHelpButton onClick={onHelp} label="Como ler os intervalos" />
      </div>
      <span className="audit-muted" style={{ fontSize: '0.75rem' }}>
        investigações auditadas deste projeto
      </span>
    </div>
    {rows.length < 2 ? (
      <p className="audit-muted" style={{ padding: '0 16px 14px', margin: 0, fontSize: '0.85rem' }}>
        Audite outra investigação deste projeto, de outro modelo, para comparar aqui.
      </p>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Modelo</th>
              <th className="right">Marcados</th>
              <th>Acerto</th>
              <th style={{ width: '40%' }}>IC 95%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.investigationId}>
                <td style={{ color: 'var(--text-heading)', fontWeight: row.investigationId === currentId ? 600 : 400 }}>
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
              <td colSpan={3} style={{ borderBottom: 'none' }} />
              <td style={{ borderBottom: 'none', paddingTop: 4 }}>
                <AxisScale />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="audit-muted" style={{ padding: '0 16px 14px', margin: 0, fontSize: '0.75rem' }}>
          Intervalos que se sobrepõem não mostram diferença clara entre os modelos.
        </p>
      </div>
    )}
  </section>
);
