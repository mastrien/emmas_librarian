import React from 'react';
import { type RAGExtractionResult } from '../../types';
import './answerCards.css';

export interface EvidenceCardProps {
  evidence: RAGExtractionResult['evidences'][0];
  onViewDocument?: (evidence: RAGExtractionResult['evidences'][0]) => void;
}

/**
 * One evidence of a RAG answer: its page and score, the quoted text, the AI's reasoning and "Visualizar no
 * Documento" when the text can be found in the PDF.
 *
 * @example <EvidenceCard evidence={evidence} onViewDocument={open} />
 */
export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, onViewDocument }) => (
  <div className="card evidence-card">
    <div className="evidence-card-head">
      <span className="evidence-card-page">Página {evidence.page}</span>
      {evidence.score !== undefined && (
        <span className="evidence-card-score">Score: {Math.round(evidence.score * 100)}</span>
      )}
    </div>
    <blockquote>{evidence.text}</blockquote>
    <p className="evidence-card-reasoning">
      <strong>Raciocínio:</strong> {evidence.reasoning}
    </p>
    {evidence.text ? (
      <button
        className="btn-secondary"
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
      <span className="evidence-card-unavailable">Texto indisponível para busca</span>
    )}
  </div>
);
