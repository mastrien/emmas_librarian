import { type Article, type InvestigationResult } from '../types';
import { type InvestigationHistoryRecord } from '../components/modals/AIExtractionModal';
import { aiAnswerText, finalAnswerText, REVIEW_LABELS } from './investigationAnswers';

const articleTitle = (articles: Article[], articleId: number): string =>
  articles.find((a) => a.id === articleId)?.title ?? `Desconhecido (ID: ${articleId})`;

const quoteCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/**
 * One row per answer. "Resposta" is the answer after review (#47): the person's text when edited, empty when rejected,
 * the AI's otherwise; "Resposta da IA" keeps what the AI said, and "Revisão" tells pending answers apart.
 *
 * Usage:
 *   formatResultsAsCsv(investigation, results, articles).split('\n')[0]; // "Artigo,Pergunta,Resposta,..."
 */
export function formatResultsAsCsv(
  investigation: InvestigationHistoryRecord,
  results: InvestigationResult[],
  articles: Article[],
): string {
  const header = ['Artigo', 'Pergunta', 'Resposta', 'Resposta da IA', 'Citação', 'Status', 'Revisão'].join(',');
  const rows = results.map((result) =>
    [
      quoteCsv(articleTitle(articles, result.article_id)),
      quoteCsv(result.question),
      quoteCsv(finalAnswerText(result)),
      quoteCsv(aiAnswerText(result)),
      quoteCsv(result.quote || ''),
      result.status,
      REVIEW_LABELS[result.review_status] ?? result.review_status,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

/**
 * The same results as JSON, with the answer after review, the AI's answer and the review status of each one.
 *
 * Usage:
 *   JSON.parse(formatResultsAsJson(investigation, results, articles)).results[0].review_status; // "pending"
 */
export function formatResultsAsJson(
  investigation: InvestigationHistoryRecord,
  results: InvestigationResult[],
  articles: Article[],
): string {
  const data = {
    investigation_id: investigation.id,
    created_at: investigation.created_at,
    status: investigation.status,
    model_used: investigation.model_used,
    results: results.map((result) => ({
      article_title: articleTitle(articles, result.article_id),
      question: result.question,
      answer: finalAnswerText(result),
      ai_answer: aiAnswerText(result),
      quote: result.quote,
      status: result.status,
      error_message: result.error_message,
      review_status: result.review_status,
      reviewed_at: result.reviewed_at,
    })),
  };
  return JSON.stringify(data, null, 2);
}
