import React from 'react';
import { Download } from 'lucide-react';
import { useDialogs } from '../../../../components/common/dialogs/DialogProvider';
import { useProjectService } from '../../../../contexts/ServicesContext';
import { describeError } from '../../../../utils/describeError';
import { EXPORT_DONE_TITLE, EXPORT_FAILED_TITLE } from '../../../../utils/exportWithFeedback';
import type { Article } from '../../../../types';
import { chartsSvg } from './chartExport';

/**
 * "Exportar gráficos" of the overview header (board 154): saves the numbers' charts as one SVG, and says so.
 *
 * @example <ExportChartsButton articles={articles} />
 */
export const ExportChartsButton: React.FC<{ articles: Article[] }> = ({ articles }) => {
  const service = useProjectService();
  const { inform } = useDialogs();
  const exportCharts = async () => {
    try {
      const saved = await service.saveExportedFile(chartsSvg(articles), 'graficos.svg');
      if (saved) await inform({ title: EXPORT_DONE_TITLE, message: 'Gráficos exportados em SVG.' });
    } catch (err) {
      await inform({ title: EXPORT_FAILED_TITLE, message: `Erro ao exportar os gráficos: ${describeError(err)}` });
    }
  };
  return (
    <button type="button" className="btn-ghost" onClick={() => void exportCharts()}>
      <Download size={16} aria-hidden="true" /> Exportar gráficos
    </button>
  );
};
