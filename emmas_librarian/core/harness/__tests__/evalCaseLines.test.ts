// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseEvalCases } from '../eval/evalCase';

const valid = { id: 'a', kind: 'happy', prompt: 'Oi', expect: { calls: [] }, checks: [] };
const line = (over: Record<string, unknown>): string => JSON.stringify({ ...valid, ...over });

describe('parseEvalCases, a line that is not a case', () => {
  it.each([
    ['no id', { id: '' }, /Line 1: no id/],
    ['an unknown kind', { kind: 'odd' }, /unknown kind.*"odd"/],
    ['no prompt', { prompt: '' }, /no prompt/],
    ['no list of expected calls', { expect: {} }, /no expect\.calls/],
    ['no expect at all', { expect: undefined }, /no expect\.calls/],
    ['no list of checks', { checks: 'x' }, /no checks list/],
  ])('refuses %s, saying the line and what it saw', (_what, over, message) => {
    expect(() => parseEvalCases(line(over))).toThrow(message);
  });

  it('counts the line from 1 and skips the blank ones in the middle', () => {
    expect(() => parseEvalCases(`${line({})}\n\n${line({ id: '' })}`)).toThrow(/Line 3/);
  });

  it('reads a valid case', () => {
    expect(parseEvalCases(line({}))).toHaveLength(1);
  });
});
