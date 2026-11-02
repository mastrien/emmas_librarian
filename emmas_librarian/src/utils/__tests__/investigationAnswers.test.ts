import { describe, it, expect } from 'vitest';
import { aiAnswerText, finalAnswerText, parseRagAnswer, canSaveCorrection } from '../investigationAnswers';

const rag = JSON.stringify({ question: 'Q', synthesizedAnswer: 'Coorte', confidenceScore: 0.8, evidences: [] });

describe('investigation answers (#47)', () => {
  it('reads the synthesized answer of a RAG result and leaves plain or broken answers alone', () => {
    expect(parseRagAnswer(rag)?.synthesizedAnswer).toBe('Coorte');
    expect(parseRagAnswer('texto simples')).toBeNull();
    expect(parseRagAnswer('{"other":1}')).toBeNull();
    expect(parseRagAnswer(null)).toBeNull();
  });

  it('gives the AI answer as text, whatever way it was stored', () => {
    expect(aiAnswerText({ answer: rag })).toBe('Coorte');
    expect(aiAnswerText({ answer: 'texto simples' })).toBe('texto simples');
    expect(aiAnswerText({ answer: null })).toBe('');
  });

  it.each([
    ['pending', null, 'Coorte'],
    ['accepted', null, 'Coorte'],
    ['edited', 'Coorte prospectiva', 'Coorte prospectiva'],
    ['rejected', null, ''],
  ] as const)('gives the answer that counts when %s', (review_status, reviewed_answer, expected) => {
    expect(finalAnswerText({ answer: rag, review_status, reviewed_answer })).toBe(expected);
  });
});

describe('canSaveCorrection', () => {
  it.each([
    ['Coorte', 'Coorte', false],
    ['  Coorte ', 'Coorte', false],
    ['   ', 'Coorte', false],
    ['Coorte prospectiva', 'Coorte', true],
  ])('%j from %j → %s', (draft, initial, expected) => {
    expect(canSaveCorrection(draft, initial)).toBe(expected);
  });
});
