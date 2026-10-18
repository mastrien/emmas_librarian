import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { InvestigationResult, RAGExtractionResult, ResultReview } from '../../../types';
import { parseRagAnswer } from '../../../utils/investigationAnswers';
import { RAGResultCard } from '../RAGResultCard';
import { ResultReviewControls } from './ResultReviewControls';

type Evidence = RAGExtractionResult['evidences'][0];

export interface InvestigationResultBlockProps {
  result: InvestigationResult;
  onViewDocument: (evidence: Evidence) => void;
  onReview: (review: ResultReview) => Promise<void>;
}

const STATUS_BORDER: Record<InvestigationResult['status'], string> = {
  success: '3px solid var(--color-success)',
  error: '3px solid var(--color-danger)',
  skipped: '3px solid var(--color-warning)',
};

const questionStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.9rem',
  marginBottom: '0.5rem',
  color: 'var(--text-heading)',
};

const FailedAnswer: React.FC<{ result: InvestigationResult }> = ({ result }) => (
  <div style={{ padding: '0.75rem' }}>
    <div style={questionStyle}>Q: {result.question}</div>
    <div
      style={{
        color: result.status === 'error' ? 'var(--color-danger)' : 'var(--color-warning)',
        fontSize: '0.85rem',
        fontWeight: 500,
      }}
    >
      {result.status === 'error' ? 'Erro: ' : 'Pulado: '}
      {result.error_message || 'Falha ao extrair resposta.'}
    </div>
  </div>
);

// Older results store the answer as plain text, not RAG JSON.
const PlainAnswer: React.FC<{ result: InvestigationResult }> = ({ result }) => (
  <div style={{ padding: '0.75rem' }}>
    <div style={questionStyle}>Q: {result.question}</div>
    <div className="markdown-body" style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer || '*Nenhuma resposta gerada*'}</ReactMarkdown>
    </div>
    {result.quote && (
      <div
        style={{
          fontSize: '0.8rem',
          fontStyle: 'italic',
          color: 'var(--text-muted)',
          borderLeft: '3px solid var(--color-primary)',
          paddingLeft: '0.5rem',
        }}
      >
        "{result.quote}"
      </div>
    )}
  </div>
);

/**
 * One question's answer for one article: the error, the RAG answer with its evidences, or the plain answer of an older
 * result. Answers that came back get the review controls (#47); errors and skipped ones have nothing to review.
 *
 * Usage:
 *   <InvestigationResultBlock result={result} onViewDocument={open} onReview={(r) => review(result.id, r)} />
 */
export const InvestigationResultBlock: React.FC<InvestigationResultBlockProps> = ({
  result,
  onViewDocument,
  onReview,
}) => {
  const failed = result.status === 'error' || result.status === 'skipped';
  const rag = failed ? null : parseRagAnswer(result.answer);
  return (
    <div
      style={{
        background: 'var(--bg-main)',
        borderRadius: 'var(--radius-sm)',
        borderLeft: STATUS_BORDER[result.status],
      }}
    >
      {failed && <FailedAnswer result={result} />}
      {rag && <RAGResultCard result={rag} onViewDocument={onViewDocument} />}
      {!failed && !rag && <PlainAnswer result={result} />}
      {result.status === 'success' && <ResultReviewControls result={result} onReview={onReview} />}
    </div>
  );
};
