// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RoutingRow } from '../eval/decision/routingSummary';
import { summarizeByKind, summarizeRouting, withThreshold } from '../eval/decision/routingSummary';

const score = { bestHit: true, top3Hit: true, allSelected: true, exact: false, extras: 1, missing: [] };
const row = (over: Partial<RoutingRow> = {}): RoutingRow => ({
  id: 'proj-1',
  kind: 'happy',
  required: ['projetos'],
  selected: ['projetos', 'diario'],
  best: 'projetos',
  bestProbability: 0.9,
  ranked: ['projetos', 'diario'],
  noul: { projetos: 0.9, diario: 0.6 },
  score,
  toolRank: 1,
  wallMs: 10,
  inputTokens: 100,
  ...over,
});

describe('summarizeRouting', () => {
  it('is all zeros for no rows, with no division by zero', () => {
    expect(summarizeRouting([])).toMatchObject({ cases: 0, needing: 0, bestHit: 0, wallMsMean: 0, wallMsMedian: 0 });
  });

  it('counts percentages over the cases that need a subject, and the refusals apart', () => {
    const rows = [
      row(),
      row({ id: 'proj-2', toolRank: null, score: { ...score, bestHit: false }, wallMs: 30 }),
      row({ id: 'rec-1', kind: 'refusal', required: [], selected: ['diario'], score: undefined, toolRank: null }),
    ];
    expect(summarizeRouting(rows)).toMatchObject({
      cases: 3,
      needing: 2,
      bestHit: 50,
      toolTop1: 50,
      noSubjectCases: 1,
      noSubjectWithSelection: 100,
    });
  });

  it('counts allInTop2 over the cases that need a subject: every needed subject within the 2 most likely', () => {
    const rows = [
      row({ required: ['projetos', 'diario'], ranked: ['diario', 'projetos', 'artigos'] }),
      row({ id: 'multi', required: ['projetos', 'diario'], ranked: ['projetos', 'artigos', 'diario'] }),
      row({ id: 'single', required: ['artigos'], ranked: ['artigos', 'projetos'] }),
      row({ id: 'late', required: ['artigos'], ranked: ['projetos', 'diario', 'artigos'] }),
      row({ id: 'rec-1', kind: 'refusal', required: [], ranked: ['projetos'], score: undefined, toolRank: null }),
    ];
    expect(summarizeRouting(rows)).toMatchObject({ needing: 4, allInTop2: 50 });
  });

  it('has allInTop2 of 0 for no case that needs a subject, with no division by zero', () => {
    expect(summarizeRouting([row({ required: [], score: undefined, toolRank: null })])).toMatchObject({
      allInTop2: 0,
    });
  });

  it('takes the middle of the sorted times as the median and rounds the mean to one decimal', () => {
    const rows = [row({ wallMs: 30 }), row({ wallMs: 10 }), row({ wallMs: 21 })];
    expect(summarizeRouting(rows)).toMatchObject({ wallMsMedian: 21, wallMsMean: 20.3 });
  });
});

describe('summarizeByKind', () => {
  it('gives one summary per kind of case, in the order they appear', () => {
    const rows = [row(), row({ id: 'rec-1', kind: 'refusal', required: [], score: undefined, toolRank: null })];
    const byKind = summarizeByKind(rows);
    expect(Object.keys(byKind)).toEqual(['happy', 'refusal']);
    expect(byKind.refusal.noSubjectCases).toBe(1);
  });
});

describe('withThreshold', () => {
  it('selects again the subjects whose probability reaches the threshold and scores them anew', () => {
    const [again] = withThreshold([row()], 0.8);
    expect(again.selected).toEqual(['projetos']);
    expect(again.score).toMatchObject({ exact: true, extras: 0 });
  });

  it('gives a refusal no score, whatever the threshold', () => {
    const [again] = withThreshold([row({ required: [], score: undefined })], 0.5);
    expect(again.score).toBeUndefined();
  });
});
