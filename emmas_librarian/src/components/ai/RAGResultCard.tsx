import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EvidenceCard } from './EvidenceCard';
import { type RAGExtractionResult } from '../../types';

export interface RAGResultCardProps {
  result: RAGExtractionResult;
  onViewDocument?: (evidence: RAGExtractionResult['evidences'][0]) => void;
}

export const RAGResultCard: React.FC<RAGResultCardProps> = ({ result, onViewDocument }) => {
  // Determine color based on confidence score (0 to 1)
  const confidenceColor = result.confidenceScore > 0.8 ? 'var(--color-success)' : result.confidenceScore > 0.5 ? '#f59e0b' : 'var(--color-danger)';
  const confidencePercentage = Math.round(result.confidenceScore * 100);

  return (
    <div
      style={{
        background: 'var(--bg-main)',
        padding: '1rem',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-heading)', flex: 1 }}>
          Q: {result.question}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '12px',
            background: confidenceColor,
            color: 'white',
            fontWeight: 'bold',
            marginLeft: '1rem',
          }}
          title="Nível de confiança da IA"
        >
          {confidencePercentage}% Confiança
        </div>
      </div>
      
      <div className="markdown-body" style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.synthesizedAnswer}</ReactMarkdown>
      </div>

      {result.evidences && result.evidences.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h6 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)', fontSize: '0.85rem' }}>
            Evidências ({result.evidences.length}):
          </h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {result.evidences.map((evidence, idx) => (
              <EvidenceCard key={idx} evidence={evidence} onViewDocument={onViewDocument} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
