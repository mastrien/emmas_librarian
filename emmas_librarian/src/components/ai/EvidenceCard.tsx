import React from 'react';
import { type RAGExtractionResult } from '../../types';

export interface EvidenceCardProps {
  evidence: RAGExtractionResult['evidences'][0];
  onViewDocument?: (evidence: RAGExtractionResult['evidences'][0]) => void;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, onViewDocument }) => {
  return (
    <div
      className="card"
      style={{
        padding: '1rem',
        border: '1px solid var(--border-color)',
        marginBottom: '0.5rem',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Página {evidence.page}</span>
        {evidence.score !== undefined && (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
            }}
          >
            Score: {Math.round(evidence.score * 100)}
          </span>
        )}
      </div>
      <blockquote
        style={{
          fontSize: '0.9rem',
          fontStyle: 'italic',
          borderLeft: '3px solid var(--color-primary)',
          paddingLeft: '0.75rem',
          margin: '0.5rem 0',
          color: 'var(--text-main)',
        }}
      >
        {evidence.text}
      </blockquote>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
        <strong>Raciocínio:</strong> {evidence.reasoning}
      </p>
      {evidence.text ? (
        <button
          className="btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
          onClick={() => {
            if (onViewDocument) {
              onViewDocument(evidence);
            } else {
              console.log('Visualizar no Documento:', evidence.text, 'Página:', evidence.page);
            }
          }}
        >
          Visualizar no Documento
        </button>
      ) : (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Texto indisponível para busca</span>
      )}
    </div>
  );
};
