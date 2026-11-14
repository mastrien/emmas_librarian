import { describe, it, expect } from 'vitest';
import { parseAndRepairJson } from '../jsonRepair';

describe('parseAndRepairJson input validation', () => {
  it.each([
    ['an empty string', ''],
    ['a non-string', 42 as unknown as string],
    ['undefined', undefined as unknown as string],
  ])('rejects %s with the offending value in the message', (_label, input) => {
    expect(() => parseAndRepairJson(input)).toThrow(
      `[ERR_INVALID_AI_RESPONSE] Resposta da IA vazia ou inválida. Offending value: ${String(input)}. Expected shape: String JSON válida.`,
    );
  });
});

describe('parseAndRepairJson well-formed input', () => {
  it('parses objects and arrays, ignoring surrounding whitespace', () => {
    expect(parseAndRepairJson('  {"a": 1, "b": [true, null]}\n')).toEqual({ a: 1, b: [true, null] });
    expect(parseAndRepairJson('[1, "x"]')).toEqual([1, 'x']);
  });

  it.each([
    ['```json fence', '```json\n{"a": 1}\n```'],
    ['uppercase ```JSON fence', '```JSON {"a": 1} ```'],
    ['bare ``` fence', '```\n{"a": 1}\n```'],
  ])('strips a %s', (_label, input) => {
    expect(parseAndRepairJson(input)).toEqual({ a: 1 });
  });

  it('keeps non-JSON-looking string values as strings', () => {
    expect(parseAndRepairJson('"just text"')).toBe('just text');
  });
});

describe('parseAndRepairJson double-encoded payloads', () => {
  it('unwraps a JSON object encoded as a string', () => {
    expect(parseAndRepairJson(JSON.stringify(JSON.stringify({ answer: 'yes' })))).toEqual({ answer: 'yes' });
  });

  it('unwraps a JSON array encoded as a string, even with leading spaces', () => {
    expect(parseAndRepairJson(JSON.stringify('  [1, 2]'))).toEqual([1, 2]);
  });

  it('returns the inner string when it only looks like JSON', () => {
    expect(parseAndRepairJson(JSON.stringify('{not json'))).toBe('{not json');
  });
});

describe('parseAndRepairJson repairs', () => {
  it('removes trailing commas in objects and arrays, including nested ones', () => {
    expect(parseAndRepairJson('{"a": [1, 2, ], "b": {"c": 3,},}')).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it('escapes raw newlines inside string values', () => {
    expect(parseAndRepairJson('{"quote": "line one\nline two"}')).toEqual({ quote: 'line one\nline two' });
  });

  it('repairs fenced output too', () => {
    expect(parseAndRepairJson('```json\n[{"q": "a",},]\n```')).toEqual([{ q: 'a' }]);
  });
});

describe('parseAndRepairJson unrecoverable input', () => {
  it('reports the first 150 characters of the cleaned input', () => {
    const garbage = `{ "a": ${'x'.repeat(200)} }`;

    expect(() => parseAndRepairJson(garbage)).toThrow(
      `[ERR_INVALID_AI_RESPONSE] A IA não retornou um formato JSON válido. Offending value: "${garbage.slice(0, 150)}...". Expected shape: Objeto JSON válido.`,
    );
  });

  it('reports the fence-stripped text, not the raw response', () => {
    expect(() => parseAndRepairJson('```json\nnot json\n```')).toThrow('Offending value: "not json..."');
  });
});
