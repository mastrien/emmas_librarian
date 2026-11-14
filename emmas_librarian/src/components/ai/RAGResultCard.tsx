import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EvidenceCard } from './EvidenceCard';
import { type RAGExtractionResult } from '../../types';
import './answerCards.css';

export interface RAGResultCardProps {
  result: RAGExtractionResult;
  onViewDocument?: (evidence: RAGExtractionResult['evidences'][0]) => void;
}

/**
 * The colour band of the AI's confidence (0 to 1): above 0.8 high, above 0.5 medium, otherwise low.
 *
 * @example confidenceLevel(0.9) // 'high'
 */
export function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score > 0.8) return 'high';
  return score > 0.5 ? 'medium' : 'low';
}

/**
 * One RAG answer (board 162): the question as the title with the AI's confidence beside it, the synthesized answer
 * in the reading face, then each evidence with its page.
 *
 * @example <RAGResultCard result={rag} onViewDocument={open} />
 */
export const RAGResultCard: React.FC<RAGResultCardProps> = ({ result, onViewDocument }) => (
  <div className="rag-card">
    <div className="rag-card-head">
      <div className="rag-card-question">{result.question}</div>
      <div
        className={`rag-card-confidence rag-card-confidence--${confidenceLevel(result.confidenceScore)}`}
        title="Nível de confiança da IA"
      >
        {Math.round(result.confidenceScore * 100)}% confiança
      </div>
    </div>

    <div className="markdown-body rag-card-answer">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.synthesizedAnswer}</ReactMarkdown>
    </div>

    {result.evidences && result.evidences.length > 0 && (
      <div className="rag-card-evidences">
        <span className="rag-card-evidences-title">Evidências · {result.evidences.length}</span>
        <div className="rag-card-evidence-list">
          {result.evidences.map((evidence, idx) => (
            <EvidenceCard key={idx} evidence={evidence} onViewDocument={onViewDocument} />
          ))}
        </div>
      </div>
    )}
  </div>
);
