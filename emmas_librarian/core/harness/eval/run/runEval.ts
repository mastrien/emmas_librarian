import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { commandSchemas } from '../../commandSchemas';
import { LibraryToolkit } from '../../LibraryToolkit';
import { FakeConfirmer } from '../support/FakeConfirmer';
import { seedLibraryF } from '../support/libraryF';
import { openTestLibrary } from '../support/openTestLibrary';
import { parseEvalCases, type EvalCase } from '../evalCase';
import { runCheck, snapshot } from '../evalChecks';
import { LlamaServerChat } from './chatClient';
import { flagsOf } from './flags';
import { toOpenAiTools } from './episode';
import { decidedConfig, decisionFile, startDecider, type RunningDecider } from '../decision/decidedSetup';
import { runMode, type DecidedOptions, type Mode } from './runMode';
import { MODELS, samplingOf, serverArgs, type ModelSpec } from './modelCatalog';
import { RunRecorder } from './runRecorder';
import { setupFromEnv } from './runSetup';
import { SCORER_VERSION, scoreEpisode } from './score';
import { startServer } from './serverProcess';
import { casesSha, chooseCases, parseMode, pickById, summarize } from './runSummary';
import { PLAN_PROMPT_VERSION } from './taskPlan';
import { systemContext } from '../../systemContext';
import { dayFromText, systemPromptFor, SYSTEM_PROMPT_VERSION } from './systemPrompt';

const EVAL_DIR = path.join(__dirname, '..');
const MAX_STEPS = 8;

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

/** What one invocation runs: the model, the mode, the cases and the files they need. */
interface RunPlan {
  args: Record<string, string>;
  mode: Mode;
  model: ModelSpec;
  casesText: string;
  cases: EvalCase[];
  setup: ReturnType<typeof setupFromEnv>;
  port: number;
  serverCommand: string[];
  decision: ReturnType<typeof decidedConfig> | undefined;
}

function planFromArgs(argv: string[]): RunPlan {
  const args = flagsOf(argv);
  const mode = parseMode(args.mode);
  const model = pickById(MODELS, args.model, 'model');
  const casesText = fs.readFileSync(path.join(EVAL_DIR, 'cases.jsonl'), 'utf-8');
  const setup = setupFromEnv(process.env);
  const port = 8089;
  const decision = mode === 'decided' ? decidedConfig(args) : undefined;
  const cases = chooseCases(parseEvalCases(casesText), args.cases);
  return { args, mode, model, casesText, cases, setup, port, decision, serverCommand: serverArgs(model, port, setup) };
}

function hostFacts(): Record<string, unknown> {
  return {
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    ramGb: Math.round(os.totalmem() / 1e9),
  };
}

/** What the run was made of besides the model: the machine, the code and the decision model file. */
function environmentOf(plan: RunPlan): Record<string, unknown> {
  const { setup, decision } = plan;
  const devices = execFileSync(setup.server, ['--list-devices'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  return {
    llamaCpp: setup.build,
    backend: setup.backend,
    modelFileBytes: fs.statSync(path.join(setup.modelsDir, plan.model.file)).size,
    devices: devices.trim(),
    host: hostFacts(),
    node: process.version,
    repoCommit: git('rev-parse', 'HEAD'),
    repoDirty: git('status', '--porcelain', '--', '.') !== '',
    decision: decision && {
      ...decision,
      file: decisionFile(decision, setup),
      fileBytes: fs.statSync(decisionFile(decision, setup)).size,
    },
  };
}

function configOf(plan: RunPlan, runId: string): Record<string, unknown> {
  const { setup, model, args } = plan;
  return {
    runId,
    label: args.label ?? null,
    startedAt: new Date().toISOString(),
    model,
    serverCommand: [setup.server, ...plan.serverCommand],
    sampling: samplingOf(model),
    ...environmentOf(plan),
    casesSha: casesSha(plan.casesText),
    caseIds: plan.cases.map((c) => c.id),
    maxSteps: MAX_STEPS,
    mode: args.mode ?? 'full',
    systemPromptVersion: SYSTEM_PROMPT_VERSION,
    planPromptVersion: plan.mode === 'planned' ? PLAN_PROMPT_VERSION : null,
    scorerVersion: SCORER_VERSION,
    modelIsLocal: 'por caso (padrão: true)',
    confirmation: 'FakeConfirmer: sim, exceto casos com confirm: no',
    library: 'Biblioteca de teste F, nova a cada caso',
  };
}

async function runAll(plan: RunPlan, chat: LlamaServerChat, recorder: RunRecorder, decided?: DecidedOptions) {
  const results: Awaited<ReturnType<typeof runCase>>[] = [];
  for (const testCase of plan.cases) {
    const result = await runCase(testCase, plan.model, chat, plan.mode, decided);
    recorder.writeEpisode(testCase.id, result);
    results.push(result);
    console.log(`${result.score.pass ? 'PASS' : 'FAIL'} ${testCase.id} ${result.wallMs}ms steps=${result.score.steps}`);
  }
  return results;
}

/** Usage: vite-node core/harness/eval/run/runEval.ts -- --model qwen3.5-4b --cases art-2,proj-1 [--label texto] [--mode full|routed|planned|decided] */
async function main(): Promise<void> {
  const plan = planFromArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runsDir = plan.setup.runsDir || path.join(EVAL_DIR, 'runs');
  const recorder = new RunRecorder(runsDir, `${stamp}_${plan.model.id}`);
  recorder.writeConfig(configOf(plan, recorder.runId));
  const server = await startServer(plan.setup.server, plan.serverCommand, plan.port);
  let decider: RunningDecider | undefined;
  try {
    decider = plan.decision && (await startDecider(plan.decision, plan.setup));
    const results = await runAll(plan, new LlamaServerChat(server.url), recorder, decider?.options);
    const label = plan.args.label ?? null;
    recorder.finish(summarize(results, { model: plan.model.id, startupMs: server.startupMs, label, mode: plan.mode }));
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
