import React from 'react';
import { KeyRequiredModal, AI_KEY_TEXT, AI_KEY_TITLE } from '../../../components/common/keyRequired/KeyRequiredModal';
import { ExploreCitationsModal } from '../../../components/modals/citations/ExploreCitationsModal';
import { useNavigate } from 'react-router-dom';
import { SearchHistoryModal } from '../../../components/modals/SearchHistoryModal';
import { ArchiveModal } from '../../../components/modals/ArchiveModal';
import { ManualArticleModal } from '../../../components/modals/ManualArticleModal';
import { EditArticleModal } from '../../../components/modals/EditArticleModal';
import { ManageQuickAccessModal } from '../../../components/modals/ManageQuickAccessModal';
import { ProjectCategoriesModal } from '../../../components/modals/ProjectCategoriesModal';
import { CitationModal } from '../../../components/modals/CitationModal';
import { MassCitationModal } from '../../../components/modals/MassCitationModal';
import { AttachPdfModal } from '../../../components/modals/AttachPdfModal';
import { ImportArticlesModal } from '../../../components/modals/ImportArticlesModal';
import { Project, Article, ProjectDocument } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { ProjectModals } from '../hooks/useProjectModals';

interface ProjectModalsContainerProps {
  projectId: number;
  /** Set when coming back from the reader to an audit (#48). */
  project: Project;
  projectDocuments: ProjectDocument[];
  history: any[];
  readArticles: Article[];
  modals: ProjectModals;
  fetchData: () => void;
  handleArchiveSubmit: (note: string) => void;
  handleEditArticleSubmit: (data: Partial<Article>) => Promise<void>;
  handleManualArticleSubmit: (data: Partial<Article>, filePath?: string) => Promise<void>;
  handleRevertSearch: (searchId: number) => void;
  showKeyAlert: boolean;
  setShowKeyAlert: (val: boolean) => void;
}

export const ProjectModalsContainer: React.FC<ProjectModalsContainerProps> = ({
  projectId,
  project,
  projectDocuments,
  history,
  readArticles,
  modals,
  fetchData,
  handleArchiveSubmit,
  handleEditArticleSubmit,
  handleManualArticleSubmit,
  handleRevertSearch,
  showKeyAlert,
  setShowKeyAlert,
}) => {
  const projectService = useProjectService();
  const navigate = useNavigate();

  return (
    <>
      <ArchiveModal
        isOpen={modals.archivingId !== null || modals.archivingIds !== null}
        count={modals.archivingIds?.length ?? 1}
        onClose={() => {
          modals.setArchivingId(null);
          modals.setArchivingIds(null);
        }}
        onSubmit={handleArchiveSubmit}
      />

      <ProjectCategoriesModal
        isOpen={modals.isCategoriesModalOpen}
        projectId={project.id}
        onClose={() => {
          modals.setIsCategoriesModalOpen(false);
          fetchData();
        }}
      />

      {modals.editingArticle && (
        <EditArticleModal
          isOpen={true}
          onClose={() => modals.setEditingArticle(null)}
          article={modals.editingArticle}
          onSubmit={handleEditArticleSubmit}
        />
      )}

      <ManualArticleModal
        isOpen={modals.isManualModalOpen}
        onClose={() => modals.setIsManualModalOpen(false)}
        onSubmit={handleManualArticleSubmit}
      />

      {modals.isHistoryOpen && (
        <SearchHistoryModal
          isOpen={modals.isHistoryOpen}
          onClose={() => modals.setIsHistoryOpen(false)}
          history={history}
          onRevertSearch={handleRevertSearch}
          onExportStrategy={(format) => projectService.exportSearchReport(project.id, format)}
          projectId={projectId}
        />
      )}

      {modals.citationSeedArticles && (
        <ExploreCitationsModal
          projectId={project.id}
          articles={modals.citationSeedArticles}
          onClose={() => modals.setCitationSeedArticles(null)}
          onSaved={fetchData}
        />
      )}

      {showKeyAlert && (
        <KeyRequiredModal
          title={AI_KEY_TITLE}
          onCancel={() => setShowKeyAlert(false)}
          onOpenSettings={() => navigate('/settings/keys')}
          onKeySaved={() => {
            setShowKeyAlert(false);
            void fetchData();
          }}
        >
          {AI_KEY_TEXT}
        </KeyRequiredModal>
      )}

      {modals.isQuickAccessModalOpen && project && (
        <ManageQuickAccessModal
          isOpen={modals.isQuickAccessModalOpen}
          onClose={() => modals.setIsQuickAccessModalOpen(false)}
          projectId={project.id}
          documents={projectDocuments}
          onDocumentsChanged={fetchData}
        />
      )}
      <CitationModal
        isOpen={!!modals.citationArticle}
        onClose={() => modals.setCitationArticle(null)}
        article={modals.citationArticle}
        onArticleUpdated={fetchData}
      />
      {modals.isMassCitationModalOpen && (
        <MassCitationModal
          isOpen={modals.isMassCitationModalOpen}
          onClose={() => {
            modals.setIsMassCitationModalOpen(false);
            modals.setMassCitationArticles(null);
          }}
          articles={modals.massCitationArticles ?? readArticles}
          onArticlesUpdated={fetchData}
        />
      )}
      {/* The article details are a panel beside the table now (board 153), not a window: ArticleInspector. */}
      {modals.isImportArticlesModalOpen && projectId && (
        <ImportArticlesModal
          isOpen={modals.isImportArticlesModalOpen}
          destProjectId={projectId}
          onClose={() => modals.setIsImportArticlesModalOpen(false)}
          onImportComplete={fetchData}
        />
      )}

      {modals.attachPdfArticle && (
        <AttachPdfModal
          isOpen={!!modals.attachPdfArticle}
          articleId={modals.attachPdfArticle.id}
          onClose={() => modals.setAttachPdfArticle(null)}
          onAttached={fetchData}
        />
      )}
    </>
  );
};
