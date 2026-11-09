import React from 'react';
import { Plus, Upload, Share2, Download } from 'lucide-react';
import { useProjectService } from '../../../contexts/ServicesContext';
import { exportWithFeedback } from '../../../utils/exportWithFeedback';
import { ToolbarMenu, type ToolbarMenuItem } from './toolbar/ToolbarMenu';
import './toolbar/projectToolbar.css';
import { useDialogs, type Dialogs } from '../../../components/common/dialogs/DialogProvider';

export interface ArticleActionsProps {
  projectId: number;
  isAddArticlesMenuOpen: boolean;
  setIsAddArticlesMenuOpen: (val: boolean) => void;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: (val: boolean) => void;
  handleBatchPdfImport: () => void;
  setIsImportArticlesModalOpen: (val: boolean) => void;
  setIsManualModalOpen: (val: boolean) => void;
  addArticlesMenuRef: React.RefObject<HTMLDivElement | null>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  handleAddMenuMouseEnter: () => void;
  handleAddMenuMouseLeave: () => void;
  handleExportMenuMouseEnter: () => void;
  handleExportMenuMouseLeave: () => void;
}

const addItems = (props: ArticleActionsProps): ToolbarMenuItem[] => [
  { icon: <Upload size={16} />, label: 'Importar PDFs em Lote', onSelect: props.handleBatchPdfImport },
  {
    icon: <Share2 size={16} />,
    label: 'Importar de outro projeto',
    onSelect: () => props.setIsImportArticlesModalOpen(true),
  },
  { icon: <Plus size={16} />, label: 'Artigo Manual', onSelect: () => props.setIsManualModalOpen(true) },
];

const exportItems = (
  projectId: number,
  service: ReturnType<typeof useProjectService>,
  inform: Dialogs['inform'],
): ToolbarMenuItem[] => [
  {
    icon: <Download size={16} />,
    label: 'Biblioshiny',
    onSelect: () => void exportWithFeedback(() => service.exportBiblioshiny(projectId), 'CSV do Biblioshiny', inform),
  },
  {
    icon: <Download size={16} />,
    label: 'Pacote .emmapcarc (com PDFs)',
    onSelect: () => void exportWithFeedback(() => service.exportProject(projectId), 'Pacote .emmapcarc', inform),
  },
];

/**
 * The actions of the Artigos screen header (board 153): Exportar, then the one primary button, Adicionar artigos.
 * Search, investigation and review moved to the project sidebar; categories and quick access to their sections.
 *
 * @example <ArticleActions projectId={3} isAddArticlesMenuOpen={open} … />
 */
export const ArticleActions: React.FC<ArticleActionsProps> = (props) => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  return (
    <>
      <ToolbarMenu
        variant="secondary"
        icon={<Download size={18} />}
        label="Exportar"
        open={props.isExportMenuOpen}
        onOpenChange={props.setIsExportMenuOpen}
        items={exportItems(props.projectId, projectService, inform)}
        menuRef={props.exportMenuRef}
        onMouseEnter={props.handleExportMenuMouseEnter}
        onMouseLeave={props.handleExportMenuMouseLeave}
      />
      <ToolbarMenu
        variant="primary"
        icon={<Plus size={18} />}
        label="Adicionar artigos"
        open={props.isAddArticlesMenuOpen}
        onOpenChange={props.setIsAddArticlesMenuOpen}
        items={addItems(props)}
        menuRef={props.addArticlesMenuRef}
        onMouseEnter={props.handleAddMenuMouseEnter}
        onMouseLeave={props.handleAddMenuMouseLeave}
      />
    </>
  );
};
