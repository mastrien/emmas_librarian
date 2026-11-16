import path from 'path';
import type { RunSetup } from '../run/runSetup';

/** A decision model: llama.cpp serves it at /v1/systemone, and it writes no text. */
export interface DecisionModelSpec {
  id: string;
  /** Where the weights came from, for the record. */
  source: string;
  file: string;
  contextSize: number;
}

export const DECISION_MODELS: DecisionModelSpec[] = [
  { id: 'd1-2b', source: 'LiquidAI/d1-2B-GGUF', file: 'd1-2B-Q4_K_M.gguf', contextSize: 4096 },
  { id: 'kev-4b', source: 'ggml-org/Kev-4B-GGUF', file: 'Kev-4B-Q4_K_M.gguf', contextSize: 4096 },
];

/**
 * The command line that starts llama-server for a decision model: every layer on the GPU, no chat template (it is not a
 * chat model).
 *
 * Usage:
 *   decisionServerArgs(DECISION_MODELS[0], 8090, setup); // ['-m', '.../d1-2B-Q4_K_M.gguf', '-ngl', '99', ...]
 */
export function decisionServerArgs(model: DecisionModelSpec, port: number, setup: RunSetup): string[] {
  const args = ['-m', path.join(setup.modelsDir, model.file), '-ngl', '99', '-c', String(model.contextSize)];
  if (setup.device) args.push('--device', setup.device);
  args.push('--port', String(port), '--host', '127.0.0.1', '--no-webui');
  return args;
}
