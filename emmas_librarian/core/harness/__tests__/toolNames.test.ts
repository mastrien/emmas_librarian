import { describe, it, expect } from 'vitest';
import { fromToolName, toToolName } from '../toolNames';

describe('tool names', () => {
  it('replaces the colon, which tool APIs do not accept, and can be undone', () => {
    expect(toToolName('articles:getByProject')).toBe('articles__getByProject');
    expect(fromToolName('articles__getByProject')).toBe('articles:getByProject');
  });

  it('keeps the hyphen of export:search-report', () => {
    expect(fromToolName(toToolName('export:search-report'))).toBe('export:search-report');
  });

  it.each([['has space:x'], ['a'.repeat(70)], ['a__b:c']])('refuses %j, naming it', (name) => {
    expect(() => toToolName(name)).toThrow(/Offending value/);
  });
});
