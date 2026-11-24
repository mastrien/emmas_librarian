// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RoutingDecision } from '../eval/decision/areaRouting';
import { parseThreshold, routingRowOf } from '../eval/decision/routingRow';
import type { DecisionReply } from '../eval/decision/systemOne';
import type { EvalCase } from '../eval/evalCase';

const caseOf = (tool: string | undefined, kind: EvalCase['kind'] = 'happy'): EvalCase => ({
  id: 'proj-1',
  kind,
  prompt: 'p',
  context: {},
  expect: { calls: tool ? [{ tool, input: null }] : [], forbidden: [], reply: '', errors: [] },
  checks: [],
});

const reply: DecisionReply = {
  answers: {
    ferramenta: {
      type: 'choice',
      choice: 'projects:getAll',
      probabilities: { 'projects:getAll': 0.6, 'projects:delete': 0.3 },
      confidence: 0.6,
    },
  },
  inputTokens: 90,
  wallMs: 12,
};
const decision: RoutingDecision = {
  ranked: [
    { area: 'projetos', probability: 0.8 },
    { area: 'diario', probability: 0.2 },
  ],
  selected: ['projetos'],
  noul: { projetos: 0.9, diario: 0.1 },
  best: 'projetos',
};

describe('parseThreshold', () => {
  it('is 0.5 without the flag and reads a probability', () => {
    expect(parseThreshold(undefined)).toBe(0.5);
    expect(parseThreshold('0.9')).toBe(0.9);
    expect(parseThreshold('1')).toBe(1);
  });

  it.each(['0', '1.5', '-0.2', 'abc', 'true'])('rejects %s with the value and the expected range', (text) => {
    expect(() => parseThreshold(text)).toThrow(/ERR_BAD_THRESHOLD.*Offending value: .*Expected a number above 0/);
  });
});

describe('routingRowOf', () => {
  it('scores the subjects and gives the place of the first ideal tool', () => {
    const row = routingRowOf(caseOf('projects:getAll'), reply, decision, ['projetos']);
    expect(row).toMatchObject({
      id: 'proj-1',
      required: ['projetos'],
      selected: ['projetos'],
      best: 'projetos',
      bestProbability: 0.8,
      ranked: ['projetos', 'diario'],
      toolRank: 1,
      wallMs: 12,
      inputTokens: 90,
    });
    expect(row.score).toMatchObject({ bestHit: true });
  });

  it('has no score for a refusal and no tool rank when the ideal tool is not ranked', () => {
    const row = routingRowOf(caseOf(undefined, 'refusal'), reply, decision, []);
    expect(row.score).toBeUndefined();
    expect(row.toolRank).toBeNull();
    expect(routingRowOf(caseOf('articles:getAll'), reply, decision, ['artigos']).toolRank).toBeNull();
  });

  it('is zero for the probability of a decision with nothing ranked', () => {
    const empty = { ...decision, ranked: [] };
    expect(routingRowOf(caseOf(undefined, 'refusal'), reply, empty, []).bestProbability).toBe(0);
  });
});
