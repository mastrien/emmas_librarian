import React from 'react';
import { libraryMetrics, type PdfFileRecord } from './pdfLibraryData';
import { formatBytes } from '../../utils/formatters';

const Tile: React.FC<{ label: string; value: React.ReactNode; note?: string }> = ({ label, value, note }) => (
  <div className="pdf-tile">
    <span className="pdf-tile__label">{label}</span>
    <span className="pdf-tile__value">{value}</span>
    {note && <span className="pdf-tile__note">{note}</span>}
  </div>
);

/**
 * The four tiles at the top of the library (board 171): files, space used, PDFs reused by several articles and
 * orphans, the last two saying what they mean.
 *
 * @example <PdfMetrics pdfs={pdfs} />
 */
export const PdfMetrics: React.FC<{ pdfs: PdfFileRecord[] }> = ({ pdfs }) => {
  const metrics = libraryMetrics(pdfs);
  return (
    <div className="pdf-tiles">
      <Tile label="Arquivos" value={metrics.total} />
      <Tile label="Espaço usado" value={formatBytes(metrics.size)} />
      <Tile label="Reutilizados" value={metrics.shared} note="o mesmo PDF em mais de um artigo" />
      <Tile label="Órfãos" value={metrics.orphans} note="sem artigo nenhum" />
    </div>
  );
};
