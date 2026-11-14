import React from 'react';
import { Download } from 'lucide-react';
import { useProjectService } from '../../../../contexts/ServicesContext';
import { useDialogs } from '../../../../components/common/dialogs/DialogProvider';
import { exportWithFeedback } from '../../../../utils/exportWithFeedback';
import { ToolbarMenu } from '../toolbar/ToolbarMenu';
import { useHoverMenu } from '../../hooks/useHoverMenu';

/**
 * "Exportar" of the categories header (board 156): the articles with one column per category, as CSV or XLSX.
 *
 * @example <CategoriesExportMenu projectId={3} />
 */
export const CategoriesExportMenu: React.FC<{ projectId: number }> = ({ projectId }) => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const menu = useHoverMenu();
  return (
    <ToolbarMenu
      variant="secondary"
      icon={<Download size={18} />}
      label="Exportar"
      open={menu.isOpen}
      onOpenChange={menu.setIsOpen}
      menuRef={menu.ref}
      onMouseEnter={menu.onMouseEnter}
      onMouseLeave={menu.onMouseLeave}
      items={[
        {
          icon: <Download size={16} />,
          label: 'Exportar CSV',
          onSelect: () => void exportWithFeedback(() => projectService.exportCsv(projectId), 'CSV', inform),
        },
        {
          icon: <Download size={16} />,
          label: 'Exportar XLSX',
          onSelect: () => void exportWithFeedback(() => projectService.exportXlsx(projectId), 'XLSX', inform),
        },
      ]}
    />
  );
};
