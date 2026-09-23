import { describe, it, expect } from 'vitest';
import { describeError } from '../describeError';

describe('describeError', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  it.each([
    ['an Error', new Error('disk full'), 'disk full'],
    ['a string', 'offline', 'offline'],
    ['an object with an error field', { error: 'bad doi' }, 'bad doi'],
    ['a plain object', { code: 7 }, '{"code":7}'],
    ['a circular object', circular, '[object Object]'],
    ['a number', 42, '42'],
    ['true', true, 'true'],
    ['an Error without message', new Error(''), '{}'],
  ])('describes %s', (_label, err, expected) => {
    expect(describeError(err)).toBe(expected);
  });

  it.each([null, undefined, '', 0, false])('falls back for %s', (err) => {
    expect(describeError(err)).toBe('Erro desconhecido');
    expect(describeError(err, 'Erro ao criar projeto')).toBe('Erro ao criar projeto');
  });
});
