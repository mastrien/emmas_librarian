// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { routingDecision, routingRequest, BEST_AREA } from '../eval/decision/areaRouting';
import { DECISION_MODELS, decisionServerArgs } from '../eval/decision/decisionCatalog';
import { areaOfTool, requiredAreas, scoreRouting } from '../eval/decision/routingMetrics';
import { summarizeByKind, summarizeRouting, type RoutingRow } from '../eval/decision/routingSummary';
import { SystemOneClient, parseDecisionReply } from '../eval/decision/systemOne';
import { BEST_TOOL, rankedTools, toolQuestion } from '../eval/decision/toolPicking';
import { DEFAULT_SETUP } from '../eval/run/runSetup';
import type { EvalCase } from '../eval/evalCase';
import type { ToolArea } from '../toolAreas';
import { FakeSystemOneServer } from './support/FakeSystemOneServer';

const AREAS: ToolArea[] = [
  { id: 'projetos', about: 'projetos', commands: ['projects:getAll', 'projects:delete'] },
  { id: 'diario', about: 'diário', commands: ['diary:appendAgentRecord'] },
];
const WIRE = {
  answers: {
    assunto: { type: 'choice', choice: 'projetos', probabilities: { projetos: 0.8, diario: 0.2 }, confidence: 0.6 },
    tem_projetos: { type: 'noul', noul: 0.9 },
    tem_diario: { type: 'noul', noul: 0.3 },
  },
  usage: { input_tokens: 130, output_tokens: 0 },
};
const caseWith = (tools: string[], kind: EvalCase['kind'] = 'happy'): EvalCase => ({
  id: 'x',
  kind,
  prompt: 'p',
  context: {},
  expect: { calls: tools.map((tool) => ({ tool, input: null })), forbidden: [], reply: '', errors: [] },
  checks: [],
});

describe('parseDecisionReply', () => {
  it('reads choice and yes/no answers and the input tokens', () => {
    const reply = parseDecisionReply(WIRE, 12);
    expect(reply.inputTokens).toBe(130);
    expect(reply.wallMs).toBe(12);
    expect(reply.answers.tem_projetos).toEqual({ type: 'noul', noul: 0.9 });
    expect(reply.answers.assunto).toMatchObject({ type: 'choice', choice: 'projetos' });
  });

  it.each([
    ['no answers', { usage: {} }],
    ['an answer of an unknown type', { answers: { a: { type: 'score', score: 1 } } }],
    ['an answer with no value', { answers: { a: { type: 'noul' } } }],
  ])('fails on %s, with the value it got', (_why, wire) => {
    expect(() => parseDecisionReply(wire, 1)).toThrow(
      /\[ERR_BAD_DECISION_REPLY\] Offending value: .*Expected \{ answers/s,
    );
  });
});

describe('SystemOneClient', () => {
  it('posts the request to /v1/systemone and returns the typed reply', async () => {
    const server = new FakeSystemOneServer(200, WIRE);
    const client = new SystemOneClient(await server.start());
    try {
      const reply = await client.decide(routingRequest('Quais projetos eu tenho?', AREAS));
      expect(server.received[0].path).toBe('/v1/systemone');
      expect(server.received[0].body).toMatchObject({ state: 'Quais projetos eu tenho?' });
      expect(reply.answers.assunto.type).toBe('choice');
    } finally {
      await server.stop();
    }
  });

  it('fails with the status and the text when the server refuses', async () => {
    const server = new FakeSystemOneServer(400, { error: 'bad question' });
    const client = new SystemOneClient(await server.start());
    try {
      await expect(client.decide(routingRequest('p', AREAS))).rejects.toThrow(
        /\[ERR_DECISION_HTTP\] .*400.*bad question/s,
      );
    } finally {
      await server.stop();
    }
  });
});

describe('routing questions and decision', () => {
  it('asks one choice over the subjects and one yes/no for each', () => {
    const request = routingRequest('Quais projetos eu tenho?', AREAS);
    expect(Object.keys(request.questions)).toEqual([BEST_AREA, 'tem_projetos', 'tem_diario']);
    expect(request.questions[BEST_AREA]).toMatchObject({
      type: 'choice',
      criteria: { projetos: 'projetos', diario: 'diário' },
    });
    expect(request.questions.tem_diario.type).toBe('noul');
  });

  it('ranks the subjects and selects those whose yes/no passes the threshold', () => {
    const decision = routingDecision(parseDecisionReply(WIRE, 1), AREAS, 0.5);
    expect(decision.best).toBe('projetos');
    expect(decision.ranked.map((r) => r.area)).toEqual(['projetos', 'diario']);
    expect(decision.selected).toEqual(['projetos']);
    expect(routingDecision(parseDecisionReply(WIRE, 1), AREAS, 0.2).selected).toEqual(['projetos', 'diario']);
  });

  it('fails when the reply has no choice for the subject', () => {
    const reply = parseDecisionReply({ answers: { tem_projetos: { type: 'noul', noul: 1 } } }, 1);
    expect(() => routingDecision(reply, AREAS, 0.5)).toThrow(
      /\[ERR_BAD_DECISION_REPLY\].*Expected a choice answer "assunto"/s,
    );
  });
});

describe('what a case needs, and the score', () => {
  const owner = areaOfTool(AREAS);

  it('names the subject of each tool and lists the ones a case needs once, in order', () => {
    expect(owner.get('projects__getAll')).toBe('projetos');
    expect(
      requiredAreas(caseWith(['projects__getAll', 'diary__appendAgentRecord', 'projects__delete']), owner),
    ).toEqual(['projetos', 'diario']);
    expect(requiredAreas(caseWith([], 'refusal'), owner)).toEqual([]);
  });

  it('scores the best subject, the top 3, the selection and the extras', () => {
    const decision = routingDecision(parseDecisionReply(WIRE, 1), AREAS, 0.5);
    expect(scoreRouting(['projetos'], decision)).toEqual({
      bestHit: true,
      top3Hit: true,
      allSelected: true,
      exact: true,
      extras: 0,
    });
    expect(scoreRouting(['diario'], decision)).toMatchObject({
      bestHit: false,
      top3Hit: true,
      allSelected: false,
      extras: 1,
    });
    expect(scoreRouting(['projetos', 'diario'], decision)).toMatchObject({
      allSelected: false,
      exact: false,
      extras: 0,
    });
  });
});

describe('tool picking', () => {
  const tools = [
    {
      name: 'projects__getAll',
      description: 'Lista os projetos.\nMais texto.',
      input_schema: { type: 'object' as const, properties: {}, required: [], additionalProperties: false as const },
    },
  ];

  it('offers every tool with the first line of its description', () => {
    expect(toolQuestion(tools)).toMatchObject({ type: 'choice', criteria: { projects__getAll: 'Lista os projetos.' } });
    expect(BEST_TOOL).toBe('ferramenta');
  });

  it('ranks tools by probability, and gives nothing for an answer that is not a choice', () => {
    const answer = { type: 'choice' as const, choice: 'b', probabilities: { a: 0.1, b: 0.7, c: 0.2 }, confidence: 0.5 };
    expect(rankedTools(answer)).toEqual(['b', 'c', 'a']);
    expect(rankedTools({ type: 'noul', noul: 1 })).toEqual([]);
    expect(rankedTools(undefined)).toEqual([]);
  });
});

describe('summarizeRouting', () => {
  const score = (over: Partial<NonNullable<RoutingRow['score']>>) => ({
    bestHit: true,
    top3Hit: true,
    allSelected: true,
    exact: true,
    extras: 0,
    ...over,
  });
  const rows: RoutingRow[] = [
    {
      id: 'a',
      kind: 'happy',
      required: ['x'],
      selected: ['x'],
      score: score({}),
      toolRank: 1,
      wallMs: 10,
      inputTokens: 100,
    },
    {
      id: 'b',
      kind: 'happy',
      required: ['x'],
      selected: ['x', 'y'],
      score: score({ exact: false, extras: 1 }),
      toolRank: 4,
      wallMs: 30,
      inputTokens: 100,
    },
    { id: 'c', kind: 'refusal', required: [], selected: ['y'], toolRank: null, wallMs: 20, inputTokens: 100 },
    { id: 'd', kind: 'refusal', required: [], selected: [], toolRank: null, wallMs: 20, inputTokens: 100 },
  ];

  it('counts the cases that need a subject and the refusals apart', () => {
    expect(summarizeRouting(rows)).toMatchObject({
      cases: 4,
      needing: 2,
      bestHit: 100,
      exact: 50,
      extrasMean: 0.5,
      toolTop1: 50,
      toolTop3: 50,
      toolTop5: 100,
      noSubjectCases: 2,
      noSubjectWithSelection: 50,
      wallMsMean: 20,
      wallMsMedian: 20,
      inputTokensMean: 100,
    });
  });

  it('gives the same summary for each kind of case', () => {
    const byKind = summarizeByKind(rows);
    expect(Object.keys(byKind)).toEqual(['happy', 'refusal']);
    expect(byKind.happy.needing).toBe(2);
    expect(byKind.refusal.noSubjectCases).toBe(2);
  });
});

describe('decisionServerArgs', () => {
  it('serves the model on the GPU with no chat template', () => {
    const args = decisionServerArgs(DECISION_MODELS[0], 8090, DEFAULT_SETUP);
    expect(args).toEqual(expect.arrayContaining(['-ngl', '99', '--device', 'Vulkan0', '--port', '8090']));
    expect(args).not.toContain('--jinja');
    expect(args[1]).toMatch(/d1-2B-Q4_K_M\.gguf$/);
  });

  it('leaves out the device when the setup has none', () => {
    expect(decisionServerArgs(DECISION_MODELS[1], 8090, { ...DEFAULT_SETUP, device: '' })).not.toContain('--device');
  });
});
