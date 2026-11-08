import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { InvestigationResult, RAGExtractionResult, ResultReview } from '../../../types';
import { parseRagAnswer } from '../../../utils/investigationAnswers';
import { RAGResultCard } from '../RAGResultCard';
import { ResultReviewControls } from './ResultReviewControls';
import '../answerCards.css';

type Evidence = RAGExtractionResult['evidences'][0];

export interface InvestigationResultBlockProps {
  result: InvestigationResult;
  onViewDocument: (evidence: Evidence) => void;
  onReview: (review: ResultReview) => Promise<void>;
}

const FailedAnswer: React.FC<{ result: InvestigationResult }> = ({ result }) => (
  <div className="answer-plain">
    <div className="answer-question">Q: {result.question}</div>
    <div className={`answer-failure answer-failure--${result.status === 'error' ? 'error' : 'skipped'}`}>
      {result.status === 'error' ? 'Erro: ' : 'Pulado: '}
      {result.error_message || 'Falha ao extrair resposta.'}
    </div>
  </div>
);

// Older results store the answer as plain text, not RAG JSON.
const PlainAnswer: React.FC<{ result: InvestigationResult }> = ({ result }) => (
  <div className="answer-plain">
    <div className="answer-question">Q: {result.question}</div>
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer || '*Nenhuma resposta gerada*'}</ReactMarkdown>
    </div>
    {result.quote && <div className="answer-quote">"{result.quote}"</div>}
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
    <div className={`answer-block answer-block--${result.status}`}>
      {failed && <FailedAnswer result={result} />}
      {rag && <RAGResultCard result={rag} onViewDocument={onViewDocument} />}
      {!failed && !rag && <PlainAnswer result={result} />}
      {result.status === 'success' && <ResultReviewControls result={result} onReview={onReview} />}
    </div>
  );
};
