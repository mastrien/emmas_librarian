import { describe, it, expect } from 'vitest';
import { auditQuestionRows, percent, sampledInOrder } from '../auditQuestions';
import { auditReturnFrom, auditToReopen, readerStateForAudit } from '../auditReturn';
import { evidencesOf } from '../auditEvidence';
import { modelAuditRows } from '../auditModels';
import { auditForExport, auditStatsJson } from '../auditExport';
import { drawStratifiedSample } from '../auditSampling';
import type { InvestigationAudit, InvestigationResult } from '../../types';

let id = 0;
function result(question: string, overrides: Partial<InvestigationResult> = {}): InvestigationResult {
  id++;
  return {
    id,
    investigation_id: 1,
    article_id: id,
    question,
    answer: 'R',
    quote: null,
    status: 'success',
    error_message: null,
    created_at: '',
    review_status: 'pending',
    reviewed_answer: null,
    reviewed_at: null,
    ...overrides,
  };
}
const audit = (investigation_id: number, seed = 7): InvestigationAudit => ({
  id: investigation_id,
  investigation_id,
  seed,
  sample_percent: 50,
  min_per_question: 1,
  created_at: '',
});

describe('audit table rows (#48)', () => {
  const results = [result('B?'), result('A?'), result('A?', { status: 'error' }), result('Extra?')];
  const sample = new Set([results[0].id, results[1].id]);

  it('numbers questions in the investigation’s order, then the ones only the results know', () => {
    const rows = auditQuestionRows(['A?', 'B?', 'Never answered?'], results, sample);

    expect(rows.map((r) => [r.number, r.question, r.answered, r.failed, r.sampled.length])).toEqual([
      [1, 'A?', 1, 1, 1],
      [2, 'B?', 1, 0, 1],
      [3, 'Never answered?', 0, 0, 0],
      [4, 'Extra?', 1, 0, 0],
    ]);
    expect(sampledInOrder(rows).map((r) => r.question)).toEqual(['A?', 'B?']);
  });

  it('writes whole percents', () => {
    expect(percent(0.8241)).toBe('82%');
  });
});

describe('going to the reader and back to the audit', () => {
  const back = { projectId: 3, investigationId: 19, resultId: 42 };

  it('opens the reader on the evidence and remembers the item', () => {
    const state = readerStateForAudit({ text: 'trecho', page: 4 }, back);

    expect(state).toEqual({ searchQuery: 'trecho', page: 4, returnTo: back });
    expect(auditReturnFrom(state)).toEqual(back);
  });

  it('reads the audit to reopen on the project page, and ignores anything else', () => {
    expect(auditToReopen({ openAudit: back })).toEqual(back);
    expect(auditToReopen({ openAudit: { ...back, resultId: 'x' } })).toBeNull();
    expect(auditReturnFrom({ searchQuery: 'q' })).toBeNull();
    expect(auditReturnFrom(null)).toBeNull();
  });
});

describe('evidences of an answer', () => {
  it('reads the RAG evidences, or the single quote of an older result', () => {
    const rag = JSON.stringify({
      question: 'Q',
      synthesizedAnswer: 'S',
      confidenceScore: 1,
      evidences: [
        { text: 'um', page: 2, bbox: null, reasoning: '' },
        { text: ' ', page: 3, bbox: null, reasoning: '' },
      ],
    });

    expect(evidencesOf(result('Q', { answer: rag }))).toEqual([{ text: 'um', page: 2 }]);
    expect(evidencesOf(result('Q', { quote: 'antiga' }))).toEqual([{ text: 'antiga' }]);
    expect(evidencesOf(result('Q'))).toEqual([]);
  });
});

describe('comparison between models', () => {
  it('computes each audited investigation from its own draw and skips what it cannot find', () => {
    const own = [result('Q', { investigation_id: 1, review_status: 'accepted' }), result('Q', { investigation_id: 1 })];
    const history = [
      { id: 1, created_at: '', model_used: 'Gemini' },
      { id: 2, created_at: '' },
    ];

    const rows = modelAuditRows(
      history,
      [audit(1), audit(2), audit(9)],
      new Map([
        [1, own],
        [2, []],
      ]),
    );

    expect(rows.map((r) => [r.investigationId, r.model, r.stats.sampled])).toEqual([
      [1, 'Gemini', 1],
      [2, 'Modelo desconhecido', 0],
    ]);
  });
});

describe('audit in the export', () => {
  it('carries the draw, which results were drawn and the rates', () => {
    const results = [result('Q', { review_status: 'accepted' }), result('Q', { review_status: 'rejected' })];
    const exported = auditForExport(['Q'], results, { ...audit(1), sample_percent: 100 })!;

    expect(exported.sample).toEqual(new Set(results.map((r) => r.id)));
    expect(exported).toMatchObject({ seed: 7, samplePercent: 100, minPerQuestion: 1 });
    expect(auditStatsJson(exported.overall)).toEqual({
      sampled: 2,
      marked: 2,
      correct: 1,
      accuracy: 0.5,
      ci95_low: 0.095,
      ci95_high: 0.905,
    });
    expect(exported.perQuestion).toHaveLength(1);
  });

  it('is absent when the investigation was never audited, and has no rates before any mark', () => {
    expect(auditForExport(['Q'], [result('Q')], null)).toBeNull();
    expect(auditStatsJson({ sampled: 1, marked: 0, correct: 0, interval: null }).accuracy).toBeNull();
  });

  it('draws the same sample the screen shows', () => {
    const results = Array.from({ length: 30 }, () => result('Q'));
    const stored = audit(1, 4321);

    expect(auditForExport(['Q'], results, stored)!.sample).toEqual(
      drawStratifiedSample(results, { seed: 4321, samplePercent: 50, minPerQuestion: 1 }),
    );
  });
});
