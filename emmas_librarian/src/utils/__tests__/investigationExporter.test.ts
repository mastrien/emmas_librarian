import { describe, it, expect } from 'vitest';
import { formatResultsAsCsv, formatResultsAsJson } from '../investigationExporter';
import { auditForExport } from '../auditExport';
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

  const base = {
    investigation_id: 1,
    status: 'success' as const,
    error_message: null,
    created_at: '2026-06-22T14:31:00Z',
    review_status: 'pending' as const,
    reviewed_answer: null,
    reviewed_at: null,
  };

  const results: InvestigationResult[] = [
    { ...base, id: 101, article_id: 10, question: 'Qual a metodologia?', answer: 'Metodologia A', quote: 'quote A' },
    { ...base, id: 102, article_id: 20, question: 'Qual a "amostra"?', answer: 'Amostra de 100', quote: null },
  ];

  // A RAG result keeps its answer as JSON; the export must show the synthesized text, not the JSON.
  const ragAnswer = JSON.stringify({ question: 'Q', synthesizedAnswer: 'Coorte', confidenceScore: 0.9, evidences: [] });

  it('formatResultsAsCsv formats results correctly and escapes quotes', () => {
    const lines = formatResultsAsCsv(investigation, results, articles).split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Artigo,Pergunta,Resposta,Resposta da IA,Citação,Status,Revisão');
    expect(lines[1]).toBe(
      '"Article 10 Title","Qual a metodologia?","Metodologia A","Metodologia A","quote A",success,pendente',
    );
    expect(lines[2]).toBe(
      '"Article ""20"" Title","Qual a ""amostra""?","Amostra de 100","Amostra de 100","",success,pendente',
    );
  });

  it('exports the answer after review: the edit when edited, nothing when rejected, the AI text from RAG JSON', () => {
    const reviewed: InvestigationResult[] = [
      { ...results[0], answer: ragAnswer, review_status: 'edited', reviewed_answer: 'Coorte prospectiva' },
      { ...results[1], answer: ragAnswer, review_status: 'rejected' },
      { ...results[1], id: 103, answer: ragAnswer, review_status: 'accepted' },
    ];

    const lines = formatResultsAsCsv(investigation, reviewed, articles).split('\n');

    expect(lines[1]).toContain('"Coorte prospectiva","Coorte","quote A",success,editada');
    expect(lines[2]).toContain('"","Coorte","",success,rejeitada');
    expect(lines[3]).toContain('"Coorte","Coorte","",success,aceita');
  });

  it('formatResultsAsJson formats results correctly, with the review of each answer', () => {
    const edited = [{ ...results[0], review_status: 'edited' as const, reviewed_answer: 'B', reviewed_at: 'when' }];
    const parsed = JSON.parse(formatResultsAsJson(investigation, [...edited, results[1]], articles));

    expect(parsed.investigation_id).toBe(1);
    expect(parsed.status).toBe('Sucesso');
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0]).toMatchObject({ answer: 'B', ai_answer: 'Metodologia A', review_status: 'edited' });
    expect(parsed.results[1].article_title).toBe('Article "20" Title');
    expect(parsed.results[1]).toMatchObject({ question: 'Qual a "amostra"?', review_status: 'pending' });
  });

  // #48: the audit travels with the export, so the rates can be checked and the draw repeated elsewhere.
  it('adds the audit: which answers were drawn, the draw and the rates', () => {
    const audited = [{ ...results[0], review_status: 'accepted' as const }, results[1]];
    const audit = auditForExport(['Qual a metodologia?', 'Qual a "amostra"?'], audited, {
      id: 1,
      investigation_id: 1,
      seed: 99,
      sample_percent: 100,
      min_per_question: 1,
      created_at: '',
    });

    const csv = formatResultsAsCsv(investigation, audited, articles, audit).split(/\r?\n/);
    const json = JSON.parse(formatResultsAsJson(investigation, audited, articles, audit));

    expect(csv[0].endsWith(',Na amostra da auditoria')).toBe(true);
    expect(csv[1].endsWith(',sim')).toBe(true);
    expect(json.results.map((r: { in_audit_sample: boolean }) => r.in_audit_sample)).toEqual([true, true]);
    expect(json.audit).toMatchObject({ seed: 99, sample_percent: 100, min_per_question: 1 });
    expect(json.audit.overall).toMatchObject({ sampled: 2, marked: 1, correct: 1, accuracy: 1 });
    expect(json.audit.per_question).toHaveLength(2);
  });

  it('leaves the audit out of an investigation that was never audited', () => {
    expect(JSON.parse(formatResultsAsJson(investigation, results, articles)).audit).toBeUndefined();
    expect(formatResultsAsCsv(investigation, results, articles).split(/\r?\n/)[0]).not.toContain('auditoria');
  });
});
