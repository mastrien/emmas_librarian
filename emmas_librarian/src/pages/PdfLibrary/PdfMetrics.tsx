import React from 'react';
import { libraryMetrics, type PdfFileRecord } from './pdfLibraryData';
import { formatBytes } from '../../utils/formatters';

const Metric: React.FC<{
  label: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
  caps?: boolean;
  value: React.ReactNode;
}> = (props) => (
  <div className="glass-panel pdf-metric">
    <div className={props.caps ? 'pdf-metric-label pdf-metric-label--caps' : 'pdf-metric-label'}>{props.label}</div>
    <div className={`pdf-metric-value pdf-metric-value--${props.tone}`}>{props.value}</div>
  </div>
);

/**
 * The four numbers at the top of the library: files, space used, PDFs reused by several articles and orphans.
 *
 * @example <PdfMetrics pdfs={pdfs} />
 */
export const PdfMetrics: React.FC<{ pdfs: PdfFileRecord[] }> = ({ pdfs }) => {
  const metrics = libraryMetrics(pdfs);
  return (
    <div className="pdf-metrics">
      <Metric label="TOTAL DE ARQUIVOS" caps tone="primary" value={metrics.total} />
      <Metric label="ESPAÇO UTILIZADO" tone="success" value={formatBytes(metrics.size)} />
      <Metric label="PDFs REUTILIZADOS" tone="warning" value={metrics.shared} />
      <Metric label="PDFs ÓRFÃOS" tone="danger" value={metrics.orphans} />
    </div>
  );
};
