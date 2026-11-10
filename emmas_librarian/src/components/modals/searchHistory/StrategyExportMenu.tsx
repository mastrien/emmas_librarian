import React from 'react';
import { Download } from 'lucide-react';
import type { SearchReportFormat } from '../../../types';
import { exportWithFeedback } from '../../../utils/exportWithFeedback';
import { useDialogs } from '../../common/dialogs/DialogProvider';
import { ToolbarMenu } from '../../../pages/ProjectDetails/components/toolbar/ToolbarMenu';
import { useHoverMenu } from '../../../pages/ProjectDetails/hooks/useHoverMenu';

/**
 * "Exportar estratégia" in the history header (board 157, #45): the search strategy report as XLSX or Markdown, each
 * telling where the file went or why it failed.
 *
 * @example <StrategyExportMenu onExport={(format) => projectService.exportSearchReport(4, format)} />
 */
export const StrategyExportMenu: React.FC<{ onExport: (format: SearchReportFormat) => Promise<string | null> }> = ({
  onExport,
}) => {
  const { inform } = useDialogs();
  const menu = useHoverMenu();
  const item = (format: SearchReportFormat, label: string) => ({
    icon: <Download size={16} />,
    label: `Exportar estratégia de busca (${label})`,
    onSelect: () => void exportWithFeedback(() => onExport(format), `Estratégia de busca (${label})`, inform),
  });
  return (
    <ToolbarMenu
      variant="secondary"
      icon={<Download size={18} />}
      label="Exportar estratégia"
      open={menu.isOpen}
      onOpenChange={menu.setIsOpen}
      menuRef={menu.ref}
      onMouseEnter={menu.onMouseEnter}
      onMouseLeave={menu.onMouseLeave}
      items={[item('xlsx', 'XLSX'), item('md', 'Markdown')]}
    />
  );
};
