import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import type { Article } from '../types';
import { useProjectData } from './ProjectDetails/hooks/useProjectData';
import { useProjectFiltering, useProjectViewState } from './ProjectDetails/hooks/useProjectFiltering';
import { useProjectModals } from './ProjectDetails/hooks/useProjectModals';
import { useProjectActions } from './ProjectDetails/hooks/useProjectActions';
import { useProjectPdfImport } from './ProjectDetails/hooks/useProjectPdfImport';
import { useHoverMenu } from './ProjectDetails/hooks/useHoverMenu';
import { ProjectDetailsSkeleton } from './ProjectDetails/components/ProjectDetailsSkeleton';
import { ProjectSectionHeader } from './ProjectDetails/components/ProjectSectionHeader';
import { ProjectOverview } from './ProjectDetails/components/overview/ProjectOverview';
import { DEFAULT_PROJECT_SECTION, isProjectSection, type ProjectSection } from '../components/common/shell/projectNav';
import { ProjectArticlesTab } from './ProjectDetails/components/ProjectArticlesTab';
import { ProjectCategoriesTab } from './ProjectDetails/components/ProjectCategoriesTab';
import { ProjectModalsContainer } from './ProjectDetails/components/ProjectModalsContainer';
import { PdfDropOverlay } from './ProjectDetails/components/PdfDropOverlay';
import { DiarySection } from '../components/common/DiarySection';
import { SearchHistoryModal } from '../components/modals/SearchHistoryModal';
import { outsideSearchIds } from '../utils/outsideSearchEntries';
import { useOpenAccessPdfs } from './ProjectDetails/hooks/useOpenAccessPdfs';
import './ProjectDetails/projectPage.css';

const ARTICLES_PER_PAGE = 50;

/**
 * Project workspace: articles with filters, statistics, diary, categories and search history,
 * plus PDF import and AI-assisted massive investigation.
 *
 * Usage (router):
 *   <Route path="/projects/:id" element={<ProjectDetailsPage />} />
 */
export const ProjectDetailsPage: React.FC = () => {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const projectId = id ? parseInt(id) : null;
  const navigate = useNavigate();
  const projectService = useProjectService();
  const modals = useProjectModals();
  // The section is in the URL (the project sidebar links to it); the session remembers the last one so
  // /projects/:id reopens where the user was.
  const activeTab = isProjectSection(section) ? section : null;
  const [lastSection, setLastSection] = useProjectViewState<ProjectSection>(
    projectId,
    'activeTab',
    DEFAULT_PROJECT_SECTION,
  );
  // The guard matters: the session setter is a new function each render, so an unguarded effect would loop.
  useEffect(() => {
    if (activeTab && activeTab !== lastSection) setLastSection(activeTab);
  }, [activeTab, lastSection, setLastSection]);
  const [showKeyAlert, setShowKeyAlert] = useState(false);
  const addMenu = useHoverMenu();
  const exportMenu = useHoverMenu();

  // Keep an open details modal in sync with the freshly loaded article.
  const refreshSelectedArticle = (loaded: Article[]) =>
    modals.setSelectedArticleForDetails((prev) => (prev ? loaded.find((a) => a.id === prev.id) || prev : null));
  const data = useProjectData(projectId, refreshSelectedArticle);
  const openAccess = useOpenAccessPdfs(data.reload);
  const filtering = useProjectFiltering(data.articles, ARTICLES_PER_PAGE, projectId);
  const actions = useProjectActions({ projectId, ...data, modals });
  const pdfImport = useProjectPdfImport({
    projectId,
    onImported: data.reload,
    isDropBlocked: () => modals.isQuickAccessModalOpen,
  });

  if (!activeTab) {
    const target = isProjectSection(lastSection) ? lastSection : DEFAULT_PROJECT_SECTION;
    return <Navigate replace to={`/projects/${id}/${target}`} />;
  }
  if (data.loading) return <ProjectDetailsSkeleton />;
  if (!data.project) return <div className="project-not-found">Projeto não encontrado.</div>;
  const project = data.project;

  return (
    <div
      id="project-details-container"
      data-testid="project-details-container"
      className="fade-in project-page"
      {...pdfImport.dropZone}
    >
      {pdfImport.isDragging && <PdfDropOverlay />}
      <ProjectSectionHeader
        section={activeTab}
        project={project}
        articles={data.articles}
        historyCount={data.history.length}
        categoryCount={data.projectCategories.length}
        actions={actions}
        onManageCategories={() => modals.setIsCategoriesModalOpen(true)}
        articleActions={{
          projectId: project.id,
          isAddArticlesMenuOpen: addMenu.isOpen,
          setIsAddArticlesMenuOpen: addMenu.setIsOpen,
          isExportMenuOpen: exportMenu.isOpen,
          setIsExportMenuOpen: exportMenu.setIsOpen,
          handleBatchPdfImport: pdfImport.importFromDialog,
          setIsImportArticlesModalOpen: modals.setIsImportArticlesModalOpen,
          setIsManualModalOpen: modals.setIsManualModalOpen,
          addArticlesMenuRef: addMenu.ref,
          exportMenuRef: exportMenu.ref,
          handleAddMenuMouseEnter: addMenu.onMouseEnter,
          handleAddMenuMouseLeave: addMenu.onMouseLeave,
          handleExportMenuMouseEnter: exportMenu.onMouseEnter,
          handleExportMenuMouseLeave: exportMenu.onMouseLeave,
        }}
      />

      {activeTab === 'articles' && (
        <ProjectArticlesTab
          filtering={filtering}
          modals={modals}
          onStatusChange={actions.changeStatus}
          onStatusChangeMany={actions.changeStatusMany}
          onUnlinkPdf={actions.unlinkPdf}
          onAttachPdf={actions.attachPdf}
          openAccess={openAccess}
          outsideSearchIds={outsideSearchIds(data.history)}
          history={data.history}
          onShowHistory={() => navigate(`/projects/${id}/history`)}
        />
      )}
      {activeTab === 'overview' && (
        <ProjectOverview
          projectId={project.id}
          articles={data.articles}
          documents={data.projectDocuments}
          onManageQuickAccess={() => modals.setIsQuickAccessModalOpen(true)}
        />
      )}
      {activeTab === 'categories' && (
        <ProjectCategoriesTab
          project={project}
          projectCategories={data.projectCategories}
          articleCategories={data.articleCategories}
          nonArchivedArticles={data.articles.filter((a) => a.status !== 'archived')}
          onCategorySaved={data.reload}
        />
      )}
      {activeTab === 'diary' && projectId !== null && <DiarySection projectId={projectId} />}
      {activeTab === 'history' && (
        <SearchHistoryModal
          isOpen={true}
          onClose={() => {}}
          history={data.history}
          embedded={true}
          onRevertSearch={actions.revertSearch}
          onExportStrategy={
            projectId === null ? undefined : (format) => projectService.exportSearchReport(projectId, format)
          }
          projectId={projectId ?? undefined}
        />
      )}

      <ProjectModalsContainer
        projectId={projectId ?? 0}
        project={project}
        projectDocuments={data.projectDocuments}
        history={data.history}
        readArticles={filtering.readArticles}
        modals={modals}
        fetchData={data.reload}
        handleArchiveSubmit={actions.archive}
        handleEditArticleSubmit={actions.editArticle}
        handleManualArticleSubmit={actions.createManualArticle}
        handleRevertSearch={actions.revertSearch}
        showKeyAlert={showKeyAlert}
        setShowKeyAlert={setShowKeyAlert}
      />
    </div>
  );
};
