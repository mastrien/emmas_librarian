import path from 'path';
import type { RunSetup } from '../run/runSetup';
import { startServer, type RunningServer } from '../../../agent/runtime/serverProcess';
import type { DecidedOptions } from '../run/runMode';
import { DECISION_MODELS, decisionServerArgs, type DecisionModelSpec } from './decisionCatalog';
import { SystemOneClient } from '../../../agent/systemOne';

/** What the decided mode runs with; all of it goes into the run record. */
export interface DecidedConfig {
  model: DecisionModelSpec;
  topAreas: number;
  minConfidence: number;
  port: number;
}

const DECISION_PORT = 8090;

function numberFlag(name: string, text: string | undefined, fallback: number): number {
  const value = text === undefined ? fallback : Number(text);
  if (Number.isFinite(value) && value >= 0) return value;
  throw new Error(
    `[ERR_BAD_FLAG] Offending value: ${JSON.stringify(text)} for --${name}. Expected a number of 0 or more.`,
  );
}

/**
 * The decided mode's settings from the command line: --decision-model (d1-2b), --top-areas (2), --min-confidence (0, which
 * never falls back on confidence).
 *
 * Usage:
 *   decidedConfig({ 'top-areas': '2', 'min-confidence': '0.6' }); // { model: d1-2b, topAreas: 2, minConfidence: 0.6, port: 8090 }
 */
export function decidedConfig(args: Record<string, string>): DecidedConfig {
  const id = args['decision-model'] ?? DECISION_MODELS[0].id;
  const model = DECISION_MODELS.find((m) => m.id === id);
  if (!model)
    throw new Error(
      `[ERR_UNKNOWN_MODEL] Offending value: ${JSON.stringify(id)}. Expected one of: ${DECISION_MODELS.map((m) => m.id).join(', ')}.`,
    );
  const topAreas = numberFlag('top-areas', args['top-areas'], 2);
  if (!Number.isInteger(topAreas) || topAreas < 1)
    throw new Error(
      `[ERR_BAD_FLAG] Offending value: ${JSON.stringify(args['top-areas'])} for --top-areas. Expected a whole number of 1 or more.`,
    );
  return {
    model,
    topAreas,
    minConfidence: numberFlag('min-confidence', args['min-confidence'], 0),
    port: DECISION_PORT,
  };
}

export interface RunningDecider {
  options: DecidedOptions;
  server: RunningServer;
  command: string[];
}

/**
 * Starts the decision model's server and gives the options the decided mode needs.
 *
 * Usage:
 *   const decider = await startDecider(decidedConfig({}), setup);  // ...  await decider.server.stop();
 */
export async function startDecider(config: DecidedConfig, setup: RunSetup): Promise<RunningDecider> {
  const command = decisionServerArgs(config.model, config.port, setup);
  const server = await startServer(setup.server, command, config.port);
  const options = {
    decider: new SystemOneClient(server.url),
    topAreas: config.topAreas,
    minConfidence: config.minConfidence,
  };
  return { options, server, command: [setup.server, ...command] };
}

/** Where the decision model's file is, for the record. */
export const decisionFile = (config: DecidedConfig, setup: RunSetup): string =>
  path.join(setup.modelsDir, config.model.file);
