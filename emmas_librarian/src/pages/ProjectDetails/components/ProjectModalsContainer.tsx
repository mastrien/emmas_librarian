import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Key } from 'lucide-react';
import { SearchHistoryModal } from '../../../components/modals/SearchHistoryModal';
import { ArchiveModal } from '../../../components/modals/ArchiveModal';
import { ManualArticleModal } from '../../../components/modals/ManualArticleModal';
import { AIExtractionModal } from '../../../components/modals/AIExtractionModal';
import { EditArticleModal } from '../../../components/modals/EditArticleModal';
import { ManageQuickAccessModal } from '../../../components/modals/ManageQuickAccessModal';
import { ProjectCategoriesModal } from '../../../components/modals/ProjectCategoriesModal';
import { CitationModal } from '../../../components/modals/CitationModal';
import { ArticleDetailsModal } from '../../../components/modals/ArticleDetailsModal';
import { MassCitationModal } from '../../../components/modals/MassCitationModal';
import { AttachPdfModal } from '../../../components/modals/AttachPdfModal';
import { ImportArticlesModal } from '../../../components/modals/ImportArticlesModal';
import { Project, Article, ProjectDocument } from '../../../types';
import { projectService } from '../../../services/api';

interface ProjectModalsContainerProps {
  projectId: number;
  project: Project;
  articles: Article[];
  projectDocuments: ProjectDocument[];
  history: any[];
  readArticles: Article[];
  investigationHistory: any[];
  modals: any; // O objeto retornado pelo useProjectModals
  fetchData: () => void;
  handleArchiveSubmit: (note: string) => void;
  handleEditArticleSubmit: (data: Partial<Article>) => Promise<void>;
  handleManualArticleSubmit: (data: Partial<Article>, filePath?: string) => Promise<void>;
  handleRevertSearch: (searchId: number) => void;
  handleCloseAIExtractionModal: () => void;
  handleMassiveExtraction: (selectedIds: number[]) => void;
  aiQuestions: string[];
  setAiQuestions: (val: string[]) => void;
  isExtracting: boolean;
  extractionProgress: { current: number; total: number };
  aiExtractionResults: any[];
  cancelExtractionRef: React.MutableRefObject<boolean>;
  showKeyAlert: boolean;
  setShowKeyAlert: (val: boolean) => void;
  setActiveTab: (val: string) => void;
}

export const ProjectModalsContainer: React.FC<ProjectModalsContainerProps> = ({
  projectId,
  project,
  articles,
  projectDocuments,
  history,
  readArticles,
  investigationHistory,
  modals,
  fetchData,
  handleArchiveSubmit,
  handleEditArticleSubmit,
  handleManualArticleSubmit,
  handleRevertSearch,
  handleCloseAIExtractionModal,
  handleMassiveExtraction,
  aiQuestions,
  setAiQuestions,
  isExtracting,
  extractionProgress,
  aiExtractionResults,
  cancelExtractionRef,
  showKeyAlert,
  setShowKeyAlert,
  setActiveTab
}) => {
  const navigate = useNavigate();
  
  return (
    <>
      <ArchiveModal 
        isOpen={modals.archivingId !== null} 
        onClose={() => modals.setArchivingId(null)} 
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
        />
      )}

      <AIExtractionModal
        isOpen={modals.isAIExtractionModalOpen}
        onClose={handleCloseAIExtractionModal}
        articles={articles}
        articlesWithPdf={articles.filter((a) => !!a.local_file_path)}
        aiQuestions={aiQuestions}
        setAiQuestions={setAiQuestions}
        handleMassiveExtraction={handleMassiveExtraction}
        isExtracting={isExtracting}
        extractionProgress={extractionProgress}
        aiExtractionResults={aiExtractionResults}
        cancelExtractionRef={cancelExtractionRef}
        investigationHistory={investigationHistory}
        searchHistory={history}
        getInvestigationResults={projectService.getInvestigationResults}
      />

      {modals.showQuotaModal &&
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
              style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)', textAlign: 'center' }}
            >
              <AlertCircle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem auto' }} />
              <h3 style={{ margin: '0 0 1rem 0' }}>Limite de Cota Atingido</h3>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>
                A sua chave de API (OpenAI/Anthropic/Gemini) parece ter esgotado o limite de cota ou os créditos
                disponíveis. Verifique o seu provedor de IA e atualize as configurações no sistema.
              </p>
              <button
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => modals.setShowQuotaModal(false)}
              >
                Entendi
              </button>
            </div>
          </div>,
          document.body,
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
          onClose={() => modals.setIsMassCitationModalOpen(false)}
          articles={readArticles}
          onArticlesUpdated={fetchData}
        />
      )}
      <ArticleDetailsModal
        isOpen={!!modals.selectedArticleForDetails}
        onClose={() => modals.setSelectedArticleForDetails(null)}
        article={
          modals.selectedArticleForDetails
            ? articles.find((a) => a.id === modals.selectedArticleForDetails.id) || modals.selectedArticleForDetails
            : null
        }
        history={history}
        onNavigateToSearch={(searchId) => {
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
