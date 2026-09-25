import React from 'react';
import type { RAGExtractionResult } from '../../../types';
import { RAGResultCard } from '../../ai/RAGResultCard';
import type { AIExtractionResult } from '../AIExtractionModal';

type Evidence = RAGExtractionResult['evidences'][0];

interface ExtractionResultListProps {
  results: AIExtractionResult[];
  onViewEvidence: (articleId: number, evidence: Evidence) => void;
}

/**
 * Per-article answers (or the article's error) of the run that just finished.
 *
 * Usage:
 *   <ExtractionResultList results={results} onViewEvidence={(id, ev) => openReader(id, ev)} />
 */
export const ExtractionResultList: React.FC<ExtractionResultListProps> = ({ results, onViewEvidence }) => {
  if (results.length === 0) return null;
  return (
    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h4 style={{ margin: 0, color: 'var(--text-heading)' }}>Resultados</h4>
      {results.map((res, idx) => (
        <div
          key={idx}
          className="card"
          style={{ padding: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '0.5rem',
            }}
          >
            <h5 style={{ margin: 0, color: 'var(--color-primary)', flex: 1 }}>{res.article.title}</h5>
          </div>
          {res.error ? (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{res.error}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {res.result?.map((r, rIdx) => (
                <RAGResultCard
                  key={rIdx}
                  result={r}
                  onViewDocument={(evidence) => onViewEvidence(res.article.id, evidence)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
