import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Brain, Plus, Upload, Share2, Download, Tag, ListChecks } from 'lucide-react';
import { Project, ProjectDocument } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { exportWithFeedback } from '../../../utils/exportWithFeedback';
import { ToolbarMenu, type ToolbarMenuItem } from './toolbar/ToolbarMenu';
import { QuickAccessPanel } from './toolbar/QuickAccessPanel';
import './toolbar/projectToolbar.css';

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

const exportItems = (projectId: number, service: ReturnType<typeof useProjectService>): ToolbarMenuItem[] => [
  {
    icon: <Download size={16} />,
    label: 'Biblioshiny',
    onSelect: () => void exportWithFeedback(() => service.exportBiblioshiny(projectId), 'CSV do Biblioshiny'),
  },
  {
    icon: <Download size={16} />,
    label: 'Pacote .emmapcarc (com PDFs)',
    onSelect: () => void exportWithFeedback(() => service.exportProject(projectId), 'Pacote .emmapcarc'),
  },
];

/**
 * The project page's actions (search, investigation, review, add articles, export, categories) and its quick
 * access links.
 *
 * @example <ProjectToolbar project={project} projectDocuments={docs} isAddArticlesMenuOpen={open} … />
 */
export const ProjectToolbar: React.FC<ProjectToolbarProps> = (props) => {
  const projectService = useProjectService();
  const id = props.project.id;
  return (
    <>
      <div className="project-toolbar">
        <Link to={`/projects/${id}/search`} className="btn-primary toolbar-button">
          <Search size={18} /> Nova busca
        </Link>
        {/* The investigation is a page of its own (#73), like the review below. */}
        <Link to={`/projects/${id}/investigation`} className="btn-secondary toolbar-button">
          <Brain size={18} /> Investigação com IA
        </Link>
        {/* The systematic review is a page of its own (#49); this page only links to it. */}
        <Link to={`/projects/${id}/review`} className="btn-secondary toolbar-button">
          <ListChecks size={18} /> Revisão sistemática
        </Link>
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
          items={exportItems(id, projectService)}
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
