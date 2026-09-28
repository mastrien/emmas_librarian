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
  // Multi-select: the articles "Arquivar…" applies one reason to; null when archiving a single article.
  const [archivingIds, setArchivingIds] = useState<number[] | null>(null);
  // Multi-select: the articles for "Citar em massa"; null means the read articles (the accordion's button).
  const [massCitationArticles, setMassCitationArticles] = useState<Article[] | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [citationArticle, setCitationArticle] = useState<Article | null>(null);
  const [selectedArticleForDetails, setSelectedArticleForDetails] = useState<Article | null>(null);
  const [attachPdfArticle, setAttachPdfArticle] = useState<{ id: number; title: string } | null>(null);

  const [showQuotaModal, setShowQuotaModal] = useState(false);

  return {
    isManualModalOpen,
    setIsManualModalOpen,
    isHistoryOpen,
    setIsHistoryOpen,
    isCategoriesModalOpen,
    setIsCategoriesModalOpen,
    isAIExtractionModalOpen,
    setIsAIExtractionModalOpen,
    isImportArticlesModalOpen,
    setIsImportArticlesModalOpen,
    isQuickAccessModalOpen,
    setIsQuickAccessModalOpen,
    isMassCitationModalOpen,
    setIsMassCitationModalOpen,

    archivingId,
    setArchivingId,
    archivingIds,
    setArchivingIds,
    massCitationArticles,
    setMassCitationArticles,
    editingArticle,
    setEditingArticle,
    citationArticle,
    setCitationArticle,
    selectedArticleForDetails,
    setSelectedArticleForDetails,
    attachPdfArticle,
    setAttachPdfArticle,

    showQuotaModal,
    setShowQuotaModal,
  };
};

export type ProjectModals = ReturnType<typeof useProjectModals>;
