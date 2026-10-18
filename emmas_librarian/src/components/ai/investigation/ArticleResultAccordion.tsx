import React, { useState } from 'react';
import type { Article, InvestigationResult, RAGExtractionResult, ResultReview } from '../../../types';
import { InvestigationResultBlock } from './InvestigationResultBlock';

export interface ArticleResultAccordionProps {
  articleId: number;
  article?: Article;
  articleResults: InvestigationResult[];
  defaultExpanded: boolean;
  onViewDocument: (evidence: RAGExtractionResult['evidences'][0]) => void;
  onReview: (resultId: number, review: ResultReview) => Promise<void>;
}

/**
 * One article of an investigation, folded by default when there are several, with every question's answer inside.
 *
 * Usage:
 *   <ArticleResultAccordion articleId={10} articleResults={results} defaultExpanded onViewDocument={open} onReview={review} />
 */
export const ArticleResultAccordion: React.FC<ArticleResultAccordionProps> = ({
  articleId,
  article,
  articleResults,
  defaultExpanded,
  onViewDocument,
  onReview,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className="card"
      style={{
        padding: '0',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isExpanded ? 'var(--bg-main)' : 'var(--bg-surface)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          transition: 'background 0.2s',
        }}
      >
        <h5 style={{ margin: '0', color: 'var(--color-primary)' }}>
          📄 Artigo: {article ? article.title : `Desconhecido (ID: ${articleId})`}
        </h5>
        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
          {articleResults.map((result) => (
            <InvestigationResultBlock
              key={result.id}
              result={result}
              onViewDocument={onViewDocument}
              onReview={(review) => onReview(result.id, review)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
