import React from 'react';
import { Download } from 'lucide-react';
import type { SearchReportFormat } from '../../../types';
import { exportWithFeedback } from '../../../utils/exportWithFeedback';
import './searchHistory.css';

interface SearchStrategyExportProps {
  /** Saves the report and answers the path, or null when the save dialog was cancelled. */
  onExport: (format: SearchReportFormat) => Promise<string | null>;
}

const FORMATS: { format: SearchReportFormat; label: string }[] = [
  { format: 'xlsx', label: 'XLSX' },
  { format: 'md', label: 'Markdown' },
];

/**
 * "Exportar estratégia de busca" in the search history (#45): one button per file type, each telling where the file
 * went or why it failed.
 *
 * Usage:
 *   <SearchStrategyExport onExport={(format) => projectService.exportSearchReport(project.id, format)} />
 */
export const SearchStrategyExport: React.FC<SearchStrategyExportProps> = ({ onExport }) => (
  <div className="history-export">
    {FORMATS.map(({ format, label }) => (
      <button
        key={format}
        type="button"
        className="btn-secondary history-export-button"
        onClick={() => exportWithFeedback(() => onExport(format), `Estratégia de busca (${label})`)}
      >
        <Download size={16} /> Exportar estratégia de busca ({label})
      </button>
    ))}
  </div>
);
