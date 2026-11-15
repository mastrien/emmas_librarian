import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { commandSchemas } from '../../commandSchemas';
import { LibraryToolkit } from '../../LibraryToolkit';
import { RoutedToolkit } from '../../RoutedToolkit';
import { FakeConfirmer } from '../../__tests__/support/FakeConfirmer';
import { seedLibraryF } from '../../__tests__/support/libraryF';
import { openTestLibrary } from '../../__tests__/support/openTestLibrary';
import { parseEvalCases, type EvalCase } from '../evalCase';
import { runCheck, snapshot } from '../evalChecks';
import { LlamaServerChat } from './chatClient';
import { flagsOf } from './flags';
import { runEpisode, toOpenAiTools } from './episode';
import { MODELS, samplingOf, serverArgs, type ModelSpec } from './modelCatalog';
import { RunRecorder } from './runRecorder';
import { SCORER_VERSION, scoreEpisode } from './score';
import { startServer } from './serverProcess';
import { dayFromText, systemPromptFor, SYSTEM_PROMPT_VERSION } from './systemPrompt';

const LLAMA_DIR = 'F:\\llm-lab\\bin\\b12425';
const EXE = path.join(LLAMA_DIR, 'llama-server.exe');
const EVAL_DIR = path.join(__dirname, '..');
const MAX_STEPS = 8;

const sha = (text: string): string => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const git = (...args: string[]): string => execFileSync('git', args, { cwd: EVAL_DIR }).toString().trim();

function chooseCases(all: EvalCase[], ids: string | undefined): EvalCase[] {
  if (!ids || ids === 'all') return all;
  const wanted = ids.split(',');
  const missing = wanted.filter((id) => !all.some((c) => c.id === id));
  if (missing.length > 0)
    throw new Error(`[ERR_UNKNOWN_CASE] Offending value: ${missing.join(', ')}. Expected ids from cases.jsonl.`);
  return all.filter((c) => wanted.includes(c.id));
}

type Mode = 'full' | 'routed';

async function runCase(testCase: EvalCase, model: ModelSpec, chat: LlamaServerChat, mode: Mode) {
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
    const system = systemPromptFor({
      today: dayFromText(testCase.context.today),
      focusProject: testCase.context.focusProject,
      routed: mode === 'routed',
    });
    const surface = mode === 'routed' ? new RoutedToolkit(toolkit) : toolkit;
    const started = Date.now();
    const record = await runEpisode({
      system,
      prompt: testCase.prompt,
      toolkit: surface,
      chat,
      sampling: samplingOf(model),
      maxSteps: MAX_STEPS,
    });
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
      toolCount: surface.tools().length,
      toolsBytes: JSON.stringify(toOpenAiTools(surface)).length,
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
  if (text === undefined || text === 'full' || text === 'routed') return text ?? 'full';
  throw new Error(`[ERR_UNKNOWN_MODE] Offending value: ${JSON.stringify(text)}. Expected full or routed.`);
}

/** Usage: vite-node core/harness/eval/run/runEval.ts -- --model qwen3.5-4b --cases art-2,proj-1 [--label texto] [--mode full|routed] */
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
  const recorder = new RunRecorder(path.join(EVAL_DIR, 'runs'), `${stamp}_${model.id}`);
  const port = 8089;
  const serverCommand = serverArgs(model, port);
  const devices = execFileSync(EXE, ['--list-devices']).toString() + '';
  recorder.writeConfig({
    runId: recorder.runId,
    label: args.label ?? null,
    startedAt: new Date().toISOString(),
    model,
    serverCommand: [EXE, ...serverCommand],
    sampling: samplingOf(model),
    llamaCpp: 'b12425',
    devices: devices.trim(),
    host: {
      os: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      ramGb: Math.round(os.totalmem() / 1e9),
    },
    node: process.version,
    repoCommit: git('rev-parse', 'HEAD'),
    repoDirty: git('status', '--porcelain', '--', '.').length > 0,
    casesSha: sha(casesText),
    caseIds: cases.map((c) => c.id),
    maxSteps: MAX_STEPS,
    mode: args.mode ?? 'full',
    systemPromptVersion: SYSTEM_PROMPT_VERSION,
    scorerVersion: SCORER_VERSION,
    modelIsLocal: 'por caso (padrão: true)',
    confirmation: 'FakeConfirmer: sim, exceto casos com confirm: no',
    library: 'Biblioteca de teste F, nova a cada caso',
  });
  const server = await startServer(EXE, serverCommand, port);
  try {
    const chat = new LlamaServerChat(server.url);
    const results: Awaited<ReturnType<typeof runCase>>[] = [];
    for (const testCase of cases) {
      const result = await runCase(testCase, model, chat, mode);
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
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
