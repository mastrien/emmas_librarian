import { useState } from 'react';
import { Article } from '../../../types';

export const useProjectModals = () => {
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isAIExtractionModalOpen, setIsAIExtractionModalOpen] = useState(false);
  const [isImportArticlesModalOpen, setIsImportArticlesModalOpen] = useState(false);
  const [isQuickAccessModalOpen, setIsQuickAccessModalOpen] = useState(false);
  const [isMassCitationModalOpen, setIsMassCitationModalOpen] = useState(false);

  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [citationArticle, setCitationArticle] = useState<Article | null>(null);
  const [selectedArticleForDetails, setSelectedArticleForDetails] = useState<Article | null>(null);
  const [attachPdfArticle, setAttachPdfArticle] = useState<{ id: number; title: string } | null>(null);

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  
  return {
    isManualModalOpen, setIsManualModalOpen,
    isHistoryOpen, setIsHistoryOpen,
    isCategoriesModalOpen, setIsCategoriesModalOpen,
    isAIExtractionModalOpen, setIsAIExtractionModalOpen,
    isImportArticlesModalOpen, setIsImportArticlesModalOpen,
    isQuickAccessModalOpen, setIsQuickAccessModalOpen,
    isMassCitationModalOpen, setIsMassCitationModalOpen,
    
    archivingId, setArchivingId,
    editingArticle, setEditingArticle,
    citationArticle, setCitationArticle,
    selectedArticleForDetails, setSelectedArticleForDetails,
    attachPdfArticle, setAttachPdfArticle,
    
    showQuotaModal, setShowQuotaModal,
  };
};
