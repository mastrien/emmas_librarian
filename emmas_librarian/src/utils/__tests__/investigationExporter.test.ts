import { describe, it, expect } from 'vitest';
import { formatResultsAsCsv, formatResultsAsJson } from '../investigationExporter';
import { type Article, type InvestigationResult } from '../../types';
import { type InvestigationHistoryRecord } from '../../components/modals/AIExtractionModal';

describe('investigationExporter', () => {
  const investigation: InvestigationHistoryRecord = {
    id: 1,
    created_at: '2026-06-22T14:30:00Z',
    status: 'Sucesso',
    model_used: 'gemini-2.5-flash',
    questions: '["Qual a metodologia?", "Qual a amostra?"]',
    articles_ids: '[10, 20]',
  };

  const articles: Article[] = [
    { id: 10, title: 'Article 10 Title', status: 'new', project_id: 1 } as Article,
    { id: 20, title: 'Article "20" Title', status: 'new', project_id: 1 } as Article,
  ];

  const results: InvestigationResult[] = [
    {
      id: 101,
      investigation_id: 1,
      article_id: 10,
      question: 'Qual a metodologia?',
      answer: 'Metodologia A',
      quote: 'quote A',
      status: 'success',
      error_message: null,
      created_at: '2026-06-22T14:31:00Z',
    },
    {
      id: 102,
      investigation_id: 1,
      article_id: 20,
      question: 'Qual a "amostra"?',
      answer: 'Amostra de 100',
      quote: null,
      status: 'success',
      error_message: null,
      created_at: '2026-06-22T14:31:00Z',
    },
  ];

  it('formatResultsAsCsv formats results correctly and escapes quotes', () => {
    const csv = formatResultsAsCsv(investigation, results, articles);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Artigo,Pergunta,Resposta,Citação,Status');
    expect(lines[1]).toBe('"Article 10 Title","Qual a metodologia?","Metodologia A","quote A",success');
    // Article 20 has quotes in title and question
    expect(lines[2]).toBe('"Article ""20"" Title","Qual a ""amostra""?","Amostra de 100","",success');
  });

  it('formatResultsAsJson formats results correctly', () => {
    const jsonStr = formatResultsAsJson(investigation, results, articles);
    const parsed = JSON.parse(jsonStr);
    
    expect(parsed.investigation_id).toBe(1);
    expect(parsed.status).toBe('Sucesso');
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].article_title).toBe('Article 10 Title');
    expect(parsed.results[1].article_title).toBe('Article "20" Title');
    expect(parsed.results[1].question).toBe('Qual a "amostra"?');
  });
});
