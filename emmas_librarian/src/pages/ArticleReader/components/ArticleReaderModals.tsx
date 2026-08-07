import React from 'react';
import { createPortal } from 'react-dom';
import { Key, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EditArticleModal } from '../../../components/modals/EditArticleModal';
import { QuotaModal } from '../../../components/modals/QuotaModal';
import { CitationModal } from '../../../components/modals/CitationModal';
import { AttachPdfModal } from '../../../components/modals/AttachPdfModal';
import { FloatingCategoriesPanel } from '../../../components/reader/FloatingCategoriesPanel';
import type { Article, ProjectCategory, ArticleCategory } from '../../../types';

interface ArticleReaderModalsProps {
  id: string | undefined;
  article: Article | null;
  isEditingMetadata: boolean;
  setIsEditingMetadata: (val: boolean) => void;
  handleEditMetadataSubmit: (data: any) => Promise<void>;
  showKeyAlert: boolean;
  setShowKeyAlert: (val: boolean) => void;
  showQuotaModal: boolean;
  setShowQuotaModal: (val: boolean) => void;
  toastMessage: string | null;
  isCitationModalOpen: boolean;
  setIsCitationModalOpen: (val: boolean) => void;
  fetchData: () => Promise<void>;
  isCategoriesOpen: boolean;
  setIsCategoriesOpen: (val: boolean) => void;
  projectCategories: ProjectCategory[];
  articleCategories: ArticleCategory[];
  isAttachModalOpen: boolean;
  setIsAttachModalOpen: (val: boolean) => void;
}

export const ArticleReaderModals: React.FC<ArticleReaderModalsProps> = ({
  id,
  article,
  isEditingMetadata,
  setIsEditingMetadata,
  handleEditMetadataSubmit,
  showKeyAlert,
  setShowKeyAlert,
  showQuotaModal,
  setShowQuotaModal,
  toastMessage,
  isCitationModalOpen,
  setIsCitationModalOpen,
  fetchData,
  isCategoriesOpen,
  setIsCategoriesOpen,
  projectCategories,
  articleCategories,
  isAttachModalOpen,
  setIsAttachModalOpen,
}) => {
  const navigate = useNavigate();

  return (
    <>
      {isEditingMetadata && article && (
        <EditArticleModal
          isOpen={true}
          onClose={() => setIsEditingMetadata(false)}
          article={article}
          onSubmit={handleEditMetadataSubmit}
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

      <QuotaModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} />

      {toastMessage &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-primary)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-full)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 99999,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <Check size={18} /> {toastMessage}
          </div>,
          document.body,
        )}

      {isCitationModalOpen && article && (
        <CitationModal
          isOpen={isCitationModalOpen}
          onClose={() => setIsCitationModalOpen(false)}
          article={article}
          onArticleUpdated={fetchData}
        />
      )}

      {/* Floating Categories Button */}
      {id && (
        <FloatingCategoriesPanel
          articleId={parseInt(id)}
          isCategoriesOpen={isCategoriesOpen}
          setIsCategoriesOpen={setIsCategoriesOpen}
          projectCategories={projectCategories}
          articleCategories={articleCategories}
        />
      )}

      {isAttachModalOpen && id && article && (
        <AttachPdfModal
          isOpen={isAttachModalOpen}
          articleId={parseInt(id)}
          articleTitle={article.title}
          onClose={() => setIsAttachModalOpen(false)}
          onAttached={fetchData}
        />
      )}
    </>
  );
};
