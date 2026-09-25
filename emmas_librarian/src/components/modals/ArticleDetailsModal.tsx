import React from 'react';
import { createPortal } from 'react-dom';
import { Article, SearchHistoryItem } from '../../types';
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
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
};

const cardStyle: React.CSSProperties = {
  maxWidth: '800px',
  width: '95%',
  maxHeight: '85vh',
  background: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--shadow-xl)',
  borderRadius: 'var(--radius-lg)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

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
}) => {
  if (!isOpen || !article) return null;

  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div className="card fade-in" onClick={(e) => e.stopPropagation()} style={cardStyle}>
        <div
          style={{
            padding: '2.5rem 2.5rem 1rem 2.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            flex: 1,
          }}
        >
          <ArticleDetailsHeader article={article} onClose={onClose} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'visible' }}>
            <ArticleMetadataGrid article={article} />
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
            <ArticleTextSections article={article} />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border-color)',
            padding: '1rem 2.5rem 1.5rem 2.5rem',
            background: 'var(--bg-main)',
          }}
        >
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
