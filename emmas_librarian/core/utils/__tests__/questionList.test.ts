import { describe, it, expect } from 'vitest';
import { questionsToJson } from '../questionList';

describe('questionsToJson', () => {
  it('stores a list as a JSON array', () => {
    expect(questionsToJson(['Qual o método?', 'Qual a amostra?'])).toBe('["Qual o método?","Qual a amostra?"]');
  });

  it('accepts the JSON text the interface sends', () => {
    expect(questionsToJson('["Q1","Q2"]')).toBe('["Q1","Q2"]');
  });

  it.each([[[]], ['Qual o método?'], ['{"a":1}'], [['ok', '  ']], ['[1,2]']])('refuses %j', (value) => {
    expect(() => questionsToJson(value as string[] | string)).toThrow(/ERR_INVALID_QUESTIONS.*Expected a list/s);
  });

  it('names the offending value in the message', () => {
    expect(() => questionsToJson('Qual o método?')).toThrow('"Qual o método?"');
  });
});
