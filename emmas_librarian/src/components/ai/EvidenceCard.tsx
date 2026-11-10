import React from 'react';
import { ChevronRight } from 'lucide-react';
import { type RAGExtractionResult } from '../../types';
import './answerCards.css';

export interface EvidenceCardProps {
  evidence: RAGExtractionResult['evidences'][0];
  onViewDocument?: (evidence: RAGExtractionResult['evidences'][0]) => void;
}

/**
 * One evidence of a RAG answer (board 162): its page and score with "Abrir no PDF" on the same line when the text
 * can be found in the PDF, the quoted text, then the AI's reasoning in small print.
 *
 * @example <EvidenceCard evidence={evidence} onViewDocument={open} />
 */
export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, onViewDocument }) => (
  <div className="evidence-card">
    <div className="evidence-card-head">
      <span className="evidence-card-page">Página {evidence.page}</span>
      {evidence.score !== undefined && (
        <span className="evidence-card-score">score {Math.round(evidence.score * 100)}</span>
      )}
      {evidence.text && onViewDocument ? (
        <button type="button" className="evidence-card-open" onClick={() => onViewDocument(evidence)}>
          Abrir no PDF <ChevronRight size={14} aria-hidden="true" />
        </button>
      ) : (
        !evidence.text && <span className="evidence-card-unavailable">Texto indisponível para busca</span>
      )}
    </div>
    <blockquote>{evidence.text}</blockquote>
    {evidence.reasoning && (
      <p className="evidence-card-reasoning">
        <strong>Raciocínio:</strong> {evidence.reasoning}
      </p>
    )}
  </div>
);
