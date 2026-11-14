import React from 'react';
import { KeyRequiredModal, AI_KEY_TEXT, AI_KEY_TITLE } from '../../../components/common/keyRequired/KeyRequiredModal';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
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
          onCategorySaved={fetchData}
        />
      )}

      {isAttachModalOpen && id && article && (
        <AttachPdfModal
          isOpen={isAttachModalOpen}
          articleId={parseInt(id)}
          onClose={() => setIsAttachModalOpen(false)}
          onAttached={fetchData}
        />
      )}
    </>
  );
};
