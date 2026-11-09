import React from 'react';
import { Plus, Upload, Share2, Download, Tag } from 'lucide-react';
import { Project, ProjectDocument } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { exportWithFeedback } from '../../../utils/exportWithFeedback';
import { ToolbarMenu, type ToolbarMenuItem } from './toolbar/ToolbarMenu';
import { QuickAccessPanel } from './toolbar/QuickAccessPanel';
import './toolbar/projectToolbar.css';
import { useDialogs, type Dialogs } from '../../../components/common/dialogs/DialogProvider';

interface ProjectToolbarProps {
  project: Project;
  projectDocuments: ProjectDocument[];
  isAddArticlesMenuOpen: boolean;
  setIsAddArticlesMenuOpen: (val: boolean) => void;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: (val: boolean) => void;
  handleBatchPdfImport: () => void;
  setIsImportArticlesModalOpen: (val: boolean) => void;
  setIsManualModalOpen: (val: boolean) => void;
  setIsCategoriesModalOpen: (val: boolean) => void;
  setIsQuickAccessModalOpen: (val: boolean) => void;
  addArticlesMenuRef: React.RefObject<HTMLDivElement | null>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  handleAddMenuMouseEnter: () => void;
  handleAddMenuMouseLeave: () => void;
  handleExportMenuMouseEnter: () => void;
  handleExportMenuMouseLeave: () => void;
}

const addItems = (props: ProjectToolbarProps): ToolbarMenuItem[] => [
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
 * The project page's actions (add articles, export, categories) and its quick access links.
 *
 * @example <ProjectToolbar project={project} projectDocuments={docs} isAddArticlesMenuOpen={open} … />
 */
export const ProjectToolbar: React.FC<ProjectToolbarProps> = (props) => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const id = props.project.id;
  return (
    <>
      <div className="project-toolbar">
        {/* Nova busca, Investigação com IA (#73) and Revisão sistemática (#49) are pages of their own, linked from
            the project sidebar since the redesign (board 150/153); this toolbar keeps the page's own actions. */}
        <ToolbarMenu
          variant="primary"
          icon={<Plus size={18} />}
          label="Adicionar Artigos"
          open={props.isAddArticlesMenuOpen}
          onOpenChange={props.setIsAddArticlesMenuOpen}
          items={addItems(props)}
          menuRef={props.addArticlesMenuRef}
          onMouseEnter={props.handleAddMenuMouseEnter}
          onMouseLeave={props.handleAddMenuMouseLeave}
        />
        <ToolbarMenu
          variant="secondary"
          icon={<Download size={18} />}
          label="Exportar"
          open={props.isExportMenuOpen}
          onOpenChange={props.setIsExportMenuOpen}
          items={exportItems(id, projectService, inform)}
          menuRef={props.exportMenuRef}
          onMouseEnter={props.handleExportMenuMouseEnter}
          onMouseLeave={props.handleExportMenuMouseLeave}
        />
        <button
          onClick={() => props.setIsCategoriesModalOpen(true)}
          className="btn-secondary toolbar-button"
          title="Gerenciar categorias de artigos"
        >
          <Tag size={18} /> Criar categorias
        </button>
      </div>
      <QuickAccessPanel
        documents={props.projectDocuments}
        onManage={() => props.setIsQuickAccessModalOpen(true)}
        onOpen={(doc) => projectService.openProjectDocumentExternal(doc.url, doc.local_file_path)}
      />
    </>
  );
};
