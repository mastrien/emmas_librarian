// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { EvalCase } from '../eval/evalCase';
import type { DecisionTrace } from '../../agent/episode';
import {
  casesSha,
  chooseCases,
  decisionSummary,
  parseMode,
  pickById,
  summarize,
  tokensPerSecond,
  type CaseOutcome,
} from '../eval/run/runSummary';

const caseOf = (id: string): EvalCase => ({
  id,
  kind: 'happy',
  prompt: 'p',
  context: {},
  expect: { calls: [], forbidden: [], reply: '', errors: [] },
  checks: [],
});

const timings = { promptTokens: 100, promptMs: 50, generatedTokens: 20, generatedMs: 400 };
const outcome = (id: string, pass: boolean, over: Partial<CaseOutcome['record']> = {}): CaseOutcome => ({
  id,
  kind: 'happy',
  wallMs: 1000,
  score: {
    usedExpectedTools: true,
    violations: [],
    unknownTools: [],
    invalidCalls: 0,
    refusedByPerson: 0,
    stateOk: true,
    steps: 1,
    pass,
  },
  record: { steps: [{ reply: { timings } }, { reply: { timings } }], stopped: 'answered', ...over },
});

describe('casesSha', () => {
  it('is the same for CRLF, CR and LF line breaks, so one file hashes alike on every machine', () => {
    const lf = '{"id":"a"}\n{"id":"b"}\n';
    expect(casesSha(lf.replace(/\n/g, '\r\n'))).toBe(casesSha(lf));
    expect(casesSha(lf.replace(/\n/g, '\r'))).toBe(casesSha(lf));
  });

  it('is 16 hex characters and changes with the content', () => {
    expect(casesSha('a')).toMatch(/^[0-9a-f]{16}$/);
    expect(casesSha('a')).not.toBe(casesSha('b'));
  });
});

describe('chooseCases', () => {
  const all = [caseOf('a'), caseOf('b'), caseOf('c')];

  it('takes every case for nothing or "all"', () => {
    expect(chooseCases(all, undefined)).toBe(all);
    expect(chooseCases(all, 'all')).toBe(all);
  });

  it('takes the named ones in the order of the file', () => {
    expect(chooseCases(all, 'c,a').map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('names the ids it does not know', () => {
    expect(() => chooseCases(all, 'a,zz,yy')).toThrow(/ERR_UNKNOWN_CASE.*zz, yy.*cases\.jsonl/);
  });
});

describe('parseMode', () => {
  it('defaults to full and accepts the four modes', () => {
    expect(parseMode(undefined)).toBe('full');
    expect(parseMode('decided')).toBe('decided');
  });

  it('names the offending mode and the valid ones', () => {
    expect(() => parseMode('fast')).toThrow(/ERR_UNKNOWN_MODE.*"fast".*full, routed, planned, decided/);
  });
});

describe('pickById', () => {
  const catalog = [{ id: 'one' }, { id: 'two' }];

  it('finds the entry', () => {
    expect(pickById(catalog, 'two', 'model')).toBe(catalog[1]);
  });

  it('fails with the value, the catalog and the kind of thing', () => {
    expect(() => pickById(catalog, undefined, 'model')).toThrow(/ERR_UNKNOWN_MODEL.*undefined.*one, two/);
  });
});

describe('tokensPerSecond', () => {
  it('rounds to one decimal and is 0 without a measured time', () => {
    expect(tokensPerSecond(20, 400)).toBe(50);
    expect(tokensPerSecond(10, 3)).toBe(3333.3);
    expect(tokensPerSecond(10, 0)).toBe(0);
  });
});

describe('decisionSummary', () => {
  const trace = (fallback: 'none' | 'low-confidence', decisionMs: number): DecisionTrace => ({
    ranked: [],
    chosen: [],
    fallback,
    decisionMs,
    decisionInputTokens: 1,
  });

  it('is empty when no case used the decision model', () => {
    expect(decisionSummary([])).toEqual({});
  });

  it('counts the fallbacks and the time of the decisions', () => {
    const summary = decisionSummary([trace('none', 100), trace('none', 201), trace('low-confidence', 50)]);
    expect(summary).toEqual({
      decision: { fallbacks: { none: 2, 'low-confidence': 1 }, decisionMsTotal: 351, decisionMsMean: 117 },
    });
  });
});

describe('summarize', () => {
  it('counts passes, sums the tokens of every model call and gives one line per case', () => {
    const summary = summarize([outcome('a', true), outcome('b', false)], { model: 'm' });
    expect(summary).toMatchObject({
      model: 'm',
      cases: 2,
      passed: 1,
      totalWallMs: 2000,
      modelCalls: 4,
      promptTokens: 400,
      generatedTokens: 80,
      promptTokensPerSecond: 2000,
      generatedTokensPerSecond: 50,
    });
    expect(summary.results).toEqual([
      { id: 'a', kind: 'happy', pass: true, steps: 1, wallMs: 1000, violations: [], stopped: 'answered' },
      { id: 'b', kind: 'happy', pass: false, steps: 1, wallMs: 1000, violations: [], stopped: 'answered' },
    ]);
  });

  it('has no decision block unless a case carries a trace, and keeps the extra fields it was given', () => {
    expect(summarize([outcome('a', true)], { mode: 'full' })).not.toHaveProperty('decision');
    const trace = { ranked: [], chosen: [], fallback: 'none' as const, decisionMs: 7, decisionInputTokens: 1 };
    expect(summarize([outcome('a', true, { decision: trace })], { mode: 'decided' })).toMatchObject({
      mode: 'decided',
      decision: { decisionMsTotal: 7 },
    });
  });

  it('is all zeros for no case', () => {
    expect(summarize([], {})).toMatchObject({ cases: 0, passed: 0, modelCalls: 0, generatedTokensPerSecond: 0 });
  });
});
