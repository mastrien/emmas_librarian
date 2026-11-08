import { describe, it, expect } from 'vitest';
import { filledQuestions, questionCountText, setQuestions, updatedOnText } from '../questionSetQueries';

describe('setQuestions', () => {
  it('reads the stored array and answers null for a malformed or non-array column', () => {
    expect(setQuestions({ questions: '["A?", "B?"]' })).toEqual(['A?', 'B?']);
    expect(setQuestions({ questions: '{broken' })).toBeNull();
    expect(setQuestions({ questions: '{"a": 1}' })).toBeNull();
  });
});

describe('questionCountText', () => {
  it('counts in the singular, the plural, and zero for a malformed row', () => {
    expect(questionCountText({ questions: '["A?"]' })).toBe('1 pergunta');
    expect(questionCountText({ questions: '["A?", "B?"]' })).toBe('2 perguntas');
    expect(questionCountText({ questions: 'x' })).toBe('0 perguntas');
  });
});

describe('filledQuestions', () => {
  it('drops the empty lines the editor keeps', () => {
    expect(filledQuestions(['A?', '  ', '', 'B?'])).toEqual(['A?', 'B?']);
  });
});

describe('updatedOnText', () => {
  it('shows the stored date, or the given day when the set has none', () => {
    const today = new Date(2026, 10, 7);
    expect(updatedOnText('2026-03-01T12:00:00', today)).toBe(new Date(2026, 2, 1).toLocaleDateString());
    expect(updatedOnText(null, today)).toBe(today.toLocaleDateString());
  });
});
