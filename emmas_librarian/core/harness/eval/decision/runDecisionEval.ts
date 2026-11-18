import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { commandSchemas } from '../../commandSchemas';
import { LibraryToolkit } from '../../LibraryToolkit';
import { TOOL_AREAS } from '../../toolAreas';
import { FakeConfirmer } from '../../__tests__/support/FakeConfirmer';
import { openTestLibrary } from '../../__tests__/support/openTestLibrary';
import { parseEvalCases, type EvalCase } from '../evalCase';
import { flagsOf } from '../run/flags';
import { setupFromEnv } from '../run/runSetup';
import { startServer, type RunningServer } from '../run/serverProcess';
import { routingDecision, routingRequest } from '../../../agent/areaRouting';
import { DECISION_MODELS, decisionServerArgs, type DecisionModelSpec } from './decisionCatalog';
import { areaOfTool, requiredAreas, scoreRouting } from './routingMetrics';
import { summarizeByKind, summarizeRouting, withThreshold, type RoutingRow } from './routingSummary';
import { SystemOneClient, type DecisionModel } from '../../../agent/systemOne';
import { BEST_TOOL, rankedTools, toolQuestion } from './toolPicking';

const EVAL_DIR = path.join(__dirname, '..');
const PORT = 8090;
/** The yes/no thresholds the result is also computed at, to choose one without asking the model again. */
const THRESHOLDS = [0.3, 0.5, 0.7, 0.8, 0.9, 0.95];

/** The tools a local model is offered, as in the other modes of the evaluation. */
function offeredTools() {
  const library = openTestLibrary();
  try {
    const toolkit = new LibraryToolkit({
      commands: library.commands,
      schemas: commandSchemas(),
      confirmer: new FakeConfirmer(true),
      modelIsLocal: true,
    });
    return toolkit.tools();
  } finally {
    library.close();
  }
}

async function rowFor(
  testCase: EvalCase,
  model: DecisionModel,
  tools: ReturnType<typeof offeredTools>,
  threshold: number,
  perArea: boolean,
): Promise<RoutingRow> {
  const request = routingRequest(testCase.prompt, TOOL_AREAS, perArea);
  if (tools.length > 0) request.questions[BEST_TOOL] = toolQuestion(tools);
  const reply = await model.decide(request);
  const decision = routingDecision(reply, TOOL_AREAS, threshold);
  const required = requiredAreas(testCase, areaOfTool(TOOL_AREAS));
  const first = testCase.expect.calls[0]?.tool;
  const place = first ? rankedTools(reply.answers[BEST_TOOL]).indexOf(first) : -1;
  return {
    id: testCase.id,
    kind: testCase.kind,
    required,
    selected: decision.selected,
    best: decision.best,
    bestProbability: decision.ranked[0]?.probability ?? 0,
    ranked: decision.ranked.map((entry) => entry.area),
    noul: decision.noul,
    score: required.length > 0 ? scoreRouting(required, decision) : undefined,
    toolRank: place >= 0 ? place + 1 : null,
    wallMs: reply.wallMs,
    inputTokens: reply.inputTokens,
  };
}

const stampOf = (): string => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function writeResult(
  spec: DecisionModelSpec,
  rows: RoutingRow[],
  server: RunningServer,
  extra: Record<string, unknown>,
): void {
  const setup = setupFromEnv(process.env);
  const out = path.join(setup.runsDir || path.join(EVAL_DIR, 'runs'), 'decision', `${stampOf()}_${spec.id}`);
  fs.mkdirSync(out, { recursive: true });
  const config = {
    ...extra,
    model: spec,
    llamaCpp: setup.build,
    llamaServer: execFileSync(setup.server, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim(),
    device: setup.device,
    startupMs: server.startupMs,
    host: { os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model },
  };
  const sweep = Object.fromEntries(THRESHOLDS.map((t) => [t, summarizeRouting(withThreshold(rows, t))]));
  const result = { config, summary: summarizeRouting(rows), sweep, byKind: summarizeByKind(rows), rows };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(out, 'server.log'), server.log());
}

/**
 * Usage: vite-node core/harness/eval/decision/runDecisionEval.ts -- --model d1-2b [--threshold 0.5] [--tools no] [--noul no] [--label texto]
 * No language model is involved: only how well a decision model routes each request of cases.jsonl to its subjects and
 * its first tool.
 */
async function main(): Promise<void> {
  const args = flagsOf(process.argv.slice(2));
  const spec = DECISION_MODELS.find((m) => m.id === args.model);
  if (!spec)
    throw new Error(
      `[ERR_UNKNOWN_MODEL] Offending value: ${JSON.stringify(args.model)}. Expected one of: ${DECISION_MODELS.map((m) => m.id).join(', ')}.`,
    );
  const threshold = Number(args.threshold ?? 0.5);
  const perArea = args.noul !== 'no';
  const cases = parseEvalCases(fs.readFileSync(path.join(EVAL_DIR, 'cases.jsonl'), 'utf-8'));
  const tools = args.tools === 'no' ? [] : offeredTools();
  const setup = setupFromEnv(process.env);
  const server = await startServer(setup.server, decisionServerArgs(spec, PORT, setup), PORT);
  try {
    const client = new SystemOneClient(server.url);
    const rows: RoutingRow[] = [];
    for (const testCase of cases) rows.push(await rowFor(testCase, client, tools, threshold, perArea));
    writeResult(spec, rows, server, { threshold, perArea, label: args.label ?? null, tools: tools.length });
    console.log(JSON.stringify(summarizeRouting(rows), null, 2));
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
