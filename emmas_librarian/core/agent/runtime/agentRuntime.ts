import path from 'node:path';
import type { ChatModel } from '../chatClient';
import { LlamaServerChat } from '../chatClient';
import { SystemOneClient, type DecisionModel } from '../systemOne';
import { agentModel, type AgentModelFile } from './agentModels';
import { chooseDevice, parseDevices } from './devices';
import { findFreePort } from './freePort';
import { ensureModelFile, type FetchLike } from './modelDownload';
import { chatServerArgs, decisionServerArgs } from './serverArgs';
import { startServer, type RunningServer } from './serverProcess';

/** A card needs room for both models and their context; below this the processor runs them. */
export const MIN_DEVICE_MEMORY_MIB = 2048;

export interface AgentRuntimeDeps {
  /** Path of llama-server. */
  server: string;
  modelsDir: string;
  /** What `llama-server --list-devices` printed. */
  listDevices: () => Promise<string>;
  fetch: FetchLike;
  consent: (model: AgentModelFile) => Promise<boolean>;
  onProgress?: (model: AgentModelFile, done: number, total: number) => void;
  /** Replaced in tests; the real one spawns llama-server. */
  start?: typeof startServer;
  findPort?: () => Promise<number>;
  ensure?: typeof ensureModelFile;
}

export interface AgentRuntime {
  chat: ChatModel;
  decider: DecisionModel;
  /** The llama.cpp device the models run on; empty means the processor. */
  device: string;
  stop: () => Promise<void>;
}

async function launch(
  deps: AgentRuntimeDeps,
  model: AgentModelFile,
  device: string,
  build: typeof chatServerArgs,
): Promise<RunningServer> {
  const port = await (deps.findPort ?? findFreePort)();
  const modelPath = path.join(deps.modelsDir, model.file);
  const args = build({ modelPath, contextSize: model.contextSize, device, port });
  return (deps.start ?? startServer)(deps.server, args, port);
}

async function stopAll(servers: Array<RunningServer | undefined>): Promise<void> {
  await Promise.all(servers.map((server) => server?.stop()));
}

/**
 * Starts both servers and waits for BOTH attempts to end. With Promise.all the first failure returned while the other
 * server was still coming up, so it was never stopped and kept the GPU memory (review of #202).
 */
async function launchBoth(
  deps: AgentRuntimeDeps,
  models: AgentModelFile[],
  device: string,
): Promise<Array<RunningServer | undefined>> {
  const started: Array<RunningServer | undefined> = [undefined, undefined];
  const attempts = await Promise.allSettled(
    models.map(async (model, index) => {
      const build = model.role === 'chat' ? chatServerArgs : decisionServerArgs;
      started[index] = await launch(deps, model, device, build);
    }),
  );
  const failed = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected');
  if (!failed) return started;
  await stopAll(started);
  throw failed.reason;
}

/**
 * Brings the agent's two models up: both files present (downloaded after a yes), a device chosen, and the chat and the
 * decision server started on free ports. `stop` ends both.
 *
 * Usage:
 *   const runtime = await startAgentRuntime(deps);
 *   // ...runtime.chat, runtime.decider...
 *   await runtime.stop();
 */
export async function startAgentRuntime(deps: AgentRuntimeDeps): Promise<AgentRuntime> {
  const models = [agentModel('chat'), agentModel('decision')];
  const ensure = deps.ensure ?? ensureModelFile;
  for (const model of models)
    await ensure(model, {
      dir: deps.modelsDir,
      fetch: deps.fetch,
      consent: deps.consent,
      onProgress: (done, total) => deps.onProgress?.(model, done, total),
    });
  const device = chooseDevice(parseDevices(await deps.listDevices()), MIN_DEVICE_MEMORY_MIB);
  const started = await launchBoth(deps, models, device);
  const [chatServer, decisionServer] = started as RunningServer[];
  return {
    chat: new LlamaServerChat(chatServer.url),
    decider: new SystemOneClient(decisionServer.url),
    device,
    stop: () => stopAll(started),
  };
}
