import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { commandSchemas } from '../../commandSchemas';
import { LibraryToolkit } from '../../LibraryToolkit';
import { FakeConfirmer } from '../../__tests__/support/FakeConfirmer';
import { seedLibraryF } from '../../__tests__/support/libraryF';
import { openTestLibrary } from '../../__tests__/support/openTestLibrary';
import { parseEvalCases, type EvalCase } from '../evalCase';
import { runCheck, snapshot } from '../evalChecks';
import { LlamaServerChat } from '../../../agent/chatClient';
import { flagsOf } from './flags';
import { toOpenAiTools, type DecisionTrace } from '../../../agent/episode';
import { decidedConfig, decisionFile, startDecider, type RunningDecider } from '../decision/decidedSetup';
import { runMode, MODES, type DecidedOptions, type Mode } from './runMode';
import { MODELS, samplingOf, serverArgs, type ModelSpec } from './modelCatalog';
import { RunRecorder } from './runRecorder';
import { setupFromEnv } from './runSetup';
import { SCORER_VERSION, scoreEpisode } from './score';
import { startServer } from '../../../agent/runtime/serverProcess';
import { PLAN_PROMPT_VERSION } from './taskPlan';
import { systemContext } from '../../systemContext';
import { systemPromptFor, SYSTEM_PROMPT_VERSION } from '../../../agent/systemPrompt';
import { dayFromText } from './systemPrompt';

const EVAL_DIR = path.join(__dirname, '..');
const MAX_STEPS = 8;

const sha = (text: string): string => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
// The code may be a zip with no repository (the Colab notebook): the record then says so instead of failing.
const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd: EVAL_DIR, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
};

function chooseCases(all: EvalCase[], ids: string | undefined): EvalCase[] {
  if (!ids || ids === 'all') return all;
  const wanted = ids.split(',');
  const missing = wanted.filter((id) => !all.some((c) => c.id === id));
  if (missing.length > 0)
    throw new Error(`[ERR_UNKNOWN_CASE] Offending value: ${missing.join(', ')}. Expected ids from cases.jsonl.`);
  return all.filter((c) => wanted.includes(c.id));
}

async function runCase(
  testCase: EvalCase,
  model: ModelSpec,
  chat: LlamaServerChat,
  mode: Mode,
  decided?: DecidedOptions,
) {
  const library = openTestLibrary();
  try {
    await seedLibraryF(library.commands);
    const before = await snapshot(library.commands);
    const confirmer = new FakeConfirmer(testCase.context.confirm !== 'no');
    const toolkit = new LibraryToolkit({
      commands: library.commands,
      schemas: commandSchemas(),
      confirmer,
      modelIsLocal: testCase.context.modelIsLocal ?? true,
    });
    const day = { today: dayFromText(testCase.context.today), focusProject: testCase.context.focusProject };
    const system = systemPromptFor({ ...day, routed: mode === 'routed' });
    const started = Date.now();
    const input = {
      system,
      planContext: systemContext(day),
      prompt: testCase.prompt,
      chat,
      sampling: samplingOf(model),
      maxSteps: MAX_STEPS,
      decided,
    };
    const { record, offered } = await runMode(mode, input, toolkit);
    const wallMs = Date.now() - started;
    const checks = await Promise.all(
      testCase.checks.map(async (check) => ({ ...check, ok: await runCheck(check, library.commands, before) })),
    );
    const score = scoreEpisode(
      testCase,
      record,
      checks.every((check) => check.ok),
    );
    return {
      id: testCase.id,
      kind: testCase.kind,
      prompt: testCase.prompt,
      context: testCase.context,
      system,
      toolCount: offered.tools().length,
      toolsBytes: JSON.stringify(toOpenAiTools(offered)).length,
      wallMs,
      asked: confirmer.asked,
      checks,
      score,
      record,
    };
  } finally {
    library.close();
  }
}

/** For the decided mode: how often the decision model was trusted, and what it cost. Empty for the other modes. */
function decisionSummary(traces: DecisionTrace[]): Record<string, unknown> {
  if (traces.length === 0) return {};
  const fallbacks: Record<string, number> = {};
  for (const trace of traces) fallbacks[trace.fallback] = (fallbacks[trace.fallback] ?? 0) + 1;
  const decisionMs = traces.reduce((total, trace) => total + trace.decisionMs, 0);
  return {
    decision: { fallbacks, decisionMsTotal: decisionMs, decisionMsMean: Math.round(decisionMs / traces.length) },
  };
}

const tokensPerSecond = (tokens: number, ms: number): number => (ms > 0 ? Math.round((tokens / ms) * 10000) / 10 : 0);

function summarize(
  results: Awaited<ReturnType<typeof runCase>>[],
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const timings = results.flatMap((r) => r.record.steps.map((s) => s.reply.timings));
  const sum = (pick: (t: (typeof timings)[number]) => number): number =>
    timings.reduce((total, t) => total + pick(t), 0);
  return {
    ...extra,
    cases: results.length,
    passed: results.filter((r) => r.score.pass).length,
    totalWallMs: results.reduce((total, r) => total + r.wallMs, 0),
    modelCalls: timings.length,
    promptTokens: sum((t) => t.promptTokens),
    generatedTokens: sum((t) => t.generatedTokens),
    promptTokensPerSecond: tokensPerSecond(
      sum((t) => t.promptTokens),
      sum((t) => t.promptMs),
    ),
    generatedTokensPerSecond: tokensPerSecond(
      sum((t) => t.generatedTokens),
      sum((t) => t.generatedMs),
    ),
    ...decisionSummary(results.flatMap((r) => (r.record.decision ? [r.record.decision] : []))),
    results: results.map((r) => ({
      id: r.id,
      kind: r.kind,
      pass: r.score.pass,
      steps: r.score.steps,
      wallMs: r.wallMs,
      violations: r.score.violations,
      stopped: r.record.stopped,
    })),
  };
}

function parseMode(text: string | undefined): Mode {
  const found = MODES.find((mode) => mode === (text ?? 'full'));
  if (found) return found;
  throw new Error(`[ERR_UNKNOWN_MODE] Offending value: ${JSON.stringify(text)}. Expected one of: ${MODES.join(', ')}.`);
}

/** Usage: vite-node core/harness/eval/run/runEval.ts -- --model qwen3.5-4b --cases art-2,proj-1 [--label texto] [--mode full|routed|planned|decided] */
async function main(): Promise<void> {
  const args = flagsOf(process.argv.slice(2));
  const mode = parseMode(args.mode);
  const model = MODELS.find((m) => m.id === args.model);
  if (!model)
    throw new Error(
      `[ERR_UNKNOWN_MODEL] Offending value: ${JSON.stringify(args.model)}. Expected one of: ${MODELS.map((m) => m.id).join(', ')}.`,
    );
  const casesText = fs.readFileSync(path.join(EVAL_DIR, 'cases.jsonl'), 'utf-8');
  const cases = chooseCases(parseEvalCases(casesText), args.cases);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const setup = setupFromEnv(process.env);
  const recorder = new RunRecorder(setup.runsDir || path.join(EVAL_DIR, 'runs'), `${stamp}_${model.id}`);
  const port = 8089;
  const decision = mode === 'decided' ? decidedConfig(args) : undefined;
  const serverCommand = serverArgs(model, port, setup);
  const devices = execFileSync(setup.server, ['--list-devices'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  recorder.writeConfig({
    runId: recorder.runId,
    label: args.label ?? null,
    startedAt: new Date().toISOString(),
    model,
    serverCommand: [setup.server, ...serverCommand],
    sampling: samplingOf(model),
    llamaCpp: setup.build,
    backend: setup.backend,
    modelFileBytes: fs.statSync(path.join(setup.modelsDir, model.file)).size,
    devices: devices.trim(),
    host: {
      os: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      ramGb: Math.round(os.totalmem() / 1e9),
    },
    node: process.version,
    repoCommit: git('rev-parse', 'HEAD'),
    repoDirty: git('status', '--porcelain', '--', '.') !== '',
    casesSha: sha(casesText),
    caseIds: cases.map((c) => c.id),
    maxSteps: MAX_STEPS,
    mode: args.mode ?? 'full',
    systemPromptVersion: SYSTEM_PROMPT_VERSION,
    planPromptVersion: mode === 'planned' ? PLAN_PROMPT_VERSION : null,
    decision: decision && {
      ...decision,
      file: decisionFile(decision, setup),
      fileBytes: fs.statSync(decisionFile(decision, setup)).size,
    },
    scorerVersion: SCORER_VERSION,
    modelIsLocal: 'por caso (padrão: true)',
    confirmation: 'FakeConfirmer: sim, exceto casos com confirm: no',
    library: 'Biblioteca de teste F, nova a cada caso',
  });
  const server = await startServer(setup.server, serverCommand, port);
  let decider: RunningDecider | undefined;
  try {
    decider = decision && (await startDecider(decision, setup));
    const chat = new LlamaServerChat(server.url);
    const results: Awaited<ReturnType<typeof runCase>>[] = [];
    for (const testCase of cases) {
      const result = await runCase(testCase, model, chat, mode, decider?.options);
      recorder.writeEpisode(testCase.id, result);
      results.push(result);
      console.log(
        `${result.score.pass ? 'PASS' : 'FAIL'} ${testCase.id} ${result.wallMs}ms steps=${result.score.steps}`,
      );
    }
    recorder.finish(
      summarize(results, { model: model.id, startupMs: server.startupMs, label: args.label ?? null, mode }),
    );
  } finally {
    recorder.writeServerLog(server.log());
    if (decider) recorder.writeServerLog(decider.server.log(), 'decision-server.log');
    await decider?.server.stop();
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
