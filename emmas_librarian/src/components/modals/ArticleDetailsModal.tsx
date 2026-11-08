import React from 'react';
import { Article, SearchHistoryItem } from '../../types';
import { Modal } from '../common/Modal';
import { ArticleDetailsHeader } from './articleDetails/ArticleDetailsHeader';
import { ArticleMetadataGrid } from './articleDetails/ArticleMetadataGrid';
import { ArticleOriginSection } from './articleDetails/ArticleOriginSection';
import { ArticlePdfSection } from './articleDetails/ArticlePdfSection';
import { ArticleTextSections } from './articleDetails/ArticleTextSections';

interface ArticleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  history?: SearchHistoryItem[];
  onNavigateToSearch?: (searchId: number) => void;
  onArticleUpdated?: () => void;
  onAttachPdf?: (article: Article) => void;
  // A search result not saved yet: it has no project origin and no PDF to open or attach.
  isSearchResult?: boolean;
}

/**
 * Everything known about one article: metadata, origin search, PDF actions, abstract, keywords and references.
 *
 * Usage:
 *   <ArticleDetailsModal isOpen={!!article} onClose={close} article={article} history={searchHistory} />
 */
export const ArticleDetailsModal: React.FC<ArticleDetailsModalProps> = ({
  isOpen,
  onClose,
  article,
  history = [],
  onNavigateToSearch,
  onArticleUpdated,
  onAttachPdf,
  isSearchResult = false,
}) => {
  if (!isOpen || !article) return null;

  return (
    <Modal label="Detalhes do artigo" title={article.title} onClose={onClose} width={800}>
      <ArticleDetailsHeader article={article} />
      <ArticleMetadataGrid article={article} />
      {!isSearchResult && (
        <>
          <ArticleOriginSection
            searchId={article.search_id}
            history={history}
            onNavigateToSearch={onNavigateToSearch}
          />
          <ArticlePdfSection
            article={article}
            onClose={onClose}
            onArticleUpdated={onArticleUpdated}
            onAttachPdf={onAttachPdf}
          />
        </>
      )}
      <ArticleTextSections article={article} />
    </Modal>
  );
};
