import React from 'react';
import { createPortal } from 'react-dom';
import { ExploreCitationsModal } from '../../../components/modals/citations/ExploreCitationsModal';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';
import { SearchHistoryModal } from '../../../components/modals/SearchHistoryModal';
import { ArchiveModal } from '../../../components/modals/ArchiveModal';
import { ManualArticleModal } from '../../../components/modals/ManualArticleModal';
import { EditArticleModal } from '../../../components/modals/EditArticleModal';
import { ManageQuickAccessModal } from '../../../components/modals/ManageQuickAccessModal';
import { ProjectCategoriesModal } from '../../../components/modals/ProjectCategoriesModal';
import { CitationModal } from '../../../components/modals/CitationModal';
import { ArticleDetailsModal } from '../../../components/modals/ArticleDetailsModal';
import { MassCitationModal } from '../../../components/modals/MassCitationModal';
import { AttachPdfModal } from '../../../components/modals/AttachPdfModal';
import { ImportArticlesModal } from '../../../components/modals/ImportArticlesModal';
import { Project, Article, ProjectDocument } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { ProjectModals } from '../hooks/useProjectModals';
import type { ProjectTabId } from './ProjectTabs';

interface ProjectModalsContainerProps {
  projectId: number;
  /** Set when coming back from the reader to an audit (#48). */
  project: Project;
  articles: Article[];
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
  setActiveTab: (tab: ProjectTabId) => void;
}

export const ProjectModalsContainer: React.FC<ProjectModalsContainerProps> = ({
  projectId,
  project,
  articles,
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
  setActiveTab,
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

      {showKeyAlert &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="card fade-in"
              style={{
                width: '100%',
                maxWidth: '450px',
                background: 'var(--bg-surface)',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                  color: 'var(--color-primary)',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                }}
              >
                <Key size={32} />
              </div>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0' }}>Chave de IA Necessária</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
                Para usar os recursos de Inteligência Artificial, você precisa primeiro configurar sua chave de API
                (OpenAI, Gemini, Anthropic ou modelo local) nas configurações do sistema.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowKeyAlert(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button onClick={() => navigate('/settings')} className="btn-primary" style={{ flex: 1 }}>
                  Configurações
                </button>
              </div>
            </div>
          </div>,
          document.body,
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
      <ArticleDetailsModal
        isOpen={!!modals.selectedArticleForDetails}
        onClose={() => modals.setSelectedArticleForDetails(null)}
        article={
          modals.selectedArticleForDetails
            ? articles.find((a) => a.id === modals.selectedArticleForDetails?.id) || modals.selectedArticleForDetails
            : null
        }
        history={history}
        onNavigateToSearch={() => {
          modals.setSelectedArticleForDetails(null);
          setActiveTab('history');
        }}
        onArticleUpdated={fetchData}
        onAttachPdf={(art) => {
          modals.setAttachPdfArticle(art);
        }}
      />

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
          articleTitle={modals.attachPdfArticle.title}
          onClose={() => modals.setAttachPdfArticle(null)}
          onAttached={fetchData}
        />
      )}
    </>
  );
};
