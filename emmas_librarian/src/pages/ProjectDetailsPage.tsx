import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import type { Article } from '../types';
import { isManualArticle } from '../utils/sourceDatabases';
import { useProjectData } from './ProjectDetails/hooks/useProjectData';
import { useProjectFiltering } from './ProjectDetails/hooks/useProjectFiltering';
import { useProjectModals } from './ProjectDetails/hooks/useProjectModals';
import { useProjectActions } from './ProjectDetails/hooks/useProjectActions';
import { useProjectPdfImport } from './ProjectDetails/hooks/useProjectPdfImport';
import { useMassiveExtraction } from './ProjectDetails/hooks/useMassiveExtraction';
import { useHoverMenu } from './ProjectDetails/hooks/useHoverMenu';
import { ProjectDetailsSkeleton } from './ProjectDetails/components/ProjectDetailsSkeleton';
import { ProjectHeader } from './ProjectDetails/components/ProjectHeader';
import { ProjectToolbar } from './ProjectDetails/components/ProjectToolbar';
import { ProjectTabs, type ProjectTabId } from './ProjectDetails/components/ProjectTabs';
import { ProjectArticlesTab } from './ProjectDetails/components/ProjectArticlesTab';
import { ProjectOverviewTab } from './ProjectDetails/components/ProjectOverviewTab';
import { ProjectCategoriesTab } from './ProjectDetails/components/ProjectCategoriesTab';
import { ProjectModalsContainer } from './ProjectDetails/components/ProjectModalsContainer';
import { PdfDropOverlay } from './ProjectDetails/components/PdfDropOverlay';
import { DiarySection } from '../components/common/DiarySection';
import { SearchHistoryModal } from '../components/modals/SearchHistoryModal';

const ARTICLES_PER_PAGE = 50;

/**
 * Project workspace: articles with filters, statistics, diary, categories and search history,
 * plus PDF import and AI-assisted massive investigation.
 *
 * Usage (router):
 *   <Route path="/projects/:id" element={<ProjectDetailsPage />} />
 */
export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? parseInt(id) : null;
  const { showError } = useGlobalError();
  const modals = useProjectModals();
  const [activeTab, setActiveTab] = useState<ProjectTabId>('articles');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showKeyAlert, setShowKeyAlert] = useState(false);
  const addMenu = useHoverMenu();
  const exportMenu = useHoverMenu();

  // Keep an open details modal in sync with the freshly loaded article.
  const refreshSelectedArticle = (loaded: Article[]) =>
    modals.setSelectedArticleForDetails((prev) => (prev ? loaded.find((a) => a.id === prev.id) || prev : null));
  const data = useProjectData(projectId, refreshSelectedArticle);
  const filtering = useProjectFiltering(data.articles, ARTICLES_PER_PAGE);
  const actions = useProjectActions({ projectId, ...data, modals });
  const pdfImport = useProjectPdfImport({
    projectId,
    onImported: data.reload,
    isDropBlocked: () => modals.isQuickAccessModalOpen,
  });
  const extraction = useMassiveExtraction({
    projectId,
    articles: data.articles,
    onQuotaExceeded: () => modals.setShowQuotaModal(true),
    onHistoryChanged: data.setInvestigationHistory,
    onFatalError: showError,
  });

  if (data.loading) return <ProjectDetailsSkeleton />;
  if (!data.project) return <div style={{ padding: '2rem', textAlign: 'center' }}>Projeto não encontrado.</div>;
  const project = data.project;

  const closeExtractionModal = () => {
    modals.setIsAIExtractionModalOpen(false);
    extraction.reset();
  };

  return (
    <div
      id="project-details-container"
      data-testid="project-details-container"
      className="fade-in"
      style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', minHeight: '80vh' }}
      {...pdfImport.dropZone}
    >
      {pdfImport.isDragging && <PdfDropOverlay />}
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          color: 'var(--text-muted)',
        }}
      >
        <ArrowLeft size={18} /> Voltar para Projetos
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <ProjectHeader
          project={project}
          articlesCount={data.articles.length}
          isEditingName={actions.isEditingName}
          setIsEditingName={actions.setIsEditingName}
          newName={actions.newName}
          setNewName={actions.setNewName}
          handleUpdateName={actions.saveName}
          handleDeleteProject={actions.deleteProject}
        />
        <ProjectToolbar
          project={project}
          projectDocuments={data.projectDocuments}
          setIsAIExtractionModalOpen={modals.setIsAIExtractionModalOpen}
          isAddArticlesMenuOpen={addMenu.isOpen}
          setIsAddArticlesMenuOpen={addMenu.setIsOpen}
          isExportMenuOpen={exportMenu.isOpen}
          setIsExportMenuOpen={exportMenu.setIsOpen}
          handleBatchPdfImport={pdfImport.importFromDialog}
          setIsImportArticlesModalOpen={modals.setIsImportArticlesModalOpen}
          setIsManualModalOpen={modals.setIsManualModalOpen}
          setIsCategoriesModalOpen={modals.setIsCategoriesModalOpen}
          setIsQuickAccessModalOpen={modals.setIsQuickAccessModalOpen}
          addArticlesMenuRef={addMenu.ref}
          exportMenuRef={exportMenu.ref}
          handleAddMenuMouseEnter={addMenu.onMouseEnter}
          handleAddMenuMouseLeave={addMenu.onMouseLeave}
          handleExportMenuMouseEnter={exportMenu.onMouseEnter}
          handleExportMenuMouseLeave={exportMenu.onMouseLeave}
        />
      </div>

      <ProjectTabs
        activeTab={activeTab}
        onSelect={setActiveTab}
        articleCount={data.articles.length}
        historyCount={data.history.length}
      />

      {activeTab === 'articles' && (
        <ProjectArticlesTab
          filtering={filtering}
          modals={modals}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
          onStatusChange={actions.changeStatus}
          onUnlinkPdf={actions.unlinkPdf}
          onAttachPdf={actions.attachPdf}
          isArticleManual={isManualArticle}
        />
      )}
      {activeTab === 'overview' && (
        <ProjectOverviewTab
          activeArticles={filtering.activeArticles}
          readArticles={filtering.readArticles}
          archivedArticles={filtering.archivedArticles}
          filteredArticles={filtering.filteredArticles}
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
        />
      )}

      <ProjectModalsContainer
        projectId={projectId ?? 0}
        project={project}
        articles={data.articles}
        projectDocuments={data.projectDocuments}
        history={data.history}
        readArticles={filtering.readArticles}
        investigationHistory={data.investigationHistory}
        modals={modals}
        fetchData={data.reload}
        handleArchiveSubmit={actions.archive}
        handleEditArticleSubmit={actions.editArticle}
        handleManualArticleSubmit={actions.createManualArticle}
        handleRevertSearch={actions.revertSearch}
        handleCloseAIExtractionModal={closeExtractionModal}
        handleMassiveExtraction={extraction.run}
        aiQuestions={extraction.questions}
        setAiQuestions={extraction.setQuestions}
        isExtracting={extraction.isExtracting}
        extractionProgress={extraction.progress}
        aiExtractionResults={extraction.results}
        cancelExtractionRef={extraction.cancelRef}
        showKeyAlert={showKeyAlert}
        setShowKeyAlert={setShowKeyAlert}
        setActiveTab={setActiveTab}
      />
    </div>
  );
};
