import { type Article, type InvestigationResult } from '../types';
import { type InvestigationHistoryRecord } from '../components/modals/AIExtractionModal';

export function formatResultsAsCsv(
  investigation: InvestigationHistoryRecord,
  results: InvestigationResult[],
  articles: Article[],
): string {
  const header = ['Artigo', 'Pergunta', 'Resposta', 'Citação', 'Status'].join(',');

  const rows = results.map((result) => {
    const article = articles.find((a) => a.id === result.article_id);
    const articleTitle = article ? article.title : `Desconhecido (ID: ${result.article_id})`;

    return [
      `"${articleTitle.replace(/"/g, '""')}"`,
      `"${result.question.replace(/"/g, '""')}"`,
      `"${(result.answer || '').replace(/"/g, '""')}"`,
      `"${(result.quote || '').replace(/"/g, '""')}"`,
      result.status,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

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
    results: results.map((result) => {
      const article = articles.find((a) => a.id === result.article_id);
      return {
        article_title: article ? article.title : `Desconhecido (ID: ${result.article_id})`,
        question: result.question,
        answer: result.answer,
        quote: result.quote,
        status: result.status,
        error_message: result.error_message,
      };
    }),
  };

  return JSON.stringify(data, null, 2);
}
