import { describe, it, expect } from 'vitest';
import { defaultSearchLimits, effectiveLimit, limitProblems, searchCost, validateSearchLimits } from '../searchLimits';

describe('effectiveLimit', () => {
  it('uses the per-base adjustment when there is one, the common value otherwise', () => {
    const limits = { common: 1000, perBase: { wos: 500 } };

    expect(effectiveLimit(limits, 'wos')).toBe(500);
    expect(effectiveLimit(limits, 'openalex')).toBe(1000);
  });
});

describe('searchCost', () => {
  it('counts one request per page and the pauses the base needs between them', () => {
    expect(searchCost('openalex', 250)).toEqual({ requests: 3, seconds: 0 });
    expect(searchCost('crossref', 1000)).toEqual({ requests: 1, seconds: 0 });
    expect(searchCost('wos', 1000)).toEqual({ requests: 20, seconds: 21 });
  });
});

describe('limitProblems', () => {
  it('flags the chosen bases whose limit passes their ceiling, saying where the value came from', () => {
    const limits = { common: 3000, perBase: { scopus: 6000 } };

    expect(limitProblems(limits, ['openalex', 'scopus', 'wos'])).toEqual([
      { base: 'scopus', value: 6000, max: 5000, fromCommon: false },
      { base: 'wos', value: 3000, max: 2500, fromCommon: true },
    ]);
  });

  it('ignores bases that were not chosen and accepts the default limits', () => {
    expect(limitProblems({ common: 3000, perBase: {} }, ['openalex'])).toEqual([]);
    expect(limitProblems(defaultSearchLimits(), ['openalex', 'crossref', 'scopus', 'wos'])).toEqual([]);
  });

  it('flags zero, negative and fractional limits', () => {
    const problems = limitProblems({ common: 0, perBase: { wos: 2.5, scopus: -1 } }, ['openalex', 'scopus', 'wos']);

    expect(problems.map((p) => p.base)).toEqual(['openalex', 'scopus', 'wos']);
  });
});

describe('validateSearchLimits', () => {
  it('returns the limit of each chosen base', () => {
    expect(validateSearchLimits({ common: 1000, perBase: { wos: 500 } }, ['openalex', 'wos'])).toEqual({
      openalex: 1000,
      wos: 500,
    });
  });

  it('rejects a limit above a ceiling with the offending value and the accepted range', () => {
    expect(() => validateSearchLimits({ common: 3000, perBase: {} }, ['openalex', 'wos'])).toThrow(
      '[ERR_INVALID_SEARCH_LIMIT] Limite de busca fora do permitido. Offending value: wos=3000. Expected shape: wos: inteiro de 1 a 2500.',
    );
  });

  it('rejects a payload that is not a limits object', () => {
    expect(() => validateSearchLimits(50, ['openalex'])).toThrow(
      /Limites de busca inválidos\. Offending value: 50\. Expected shape: \{ common: number/,
    );
  });
});
