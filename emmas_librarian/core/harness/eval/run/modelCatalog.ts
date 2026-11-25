import path from 'path';
import { chatServerArgs } from '../../../agent/runtime/serverArgs';
import { DEFAULT_SETUP, type RunSetup } from './runSetup';

/** One model of the comparison, with everything that decides how it is run. All of it is written into the run record. */
export interface ModelSpec {
  id: string;
  /** Where the weights came from, for the record. */
  source: string;
  file: string;
  /** The model's own card recommends these; the same values are used on every case. */
  temperature: number;
  topK?: number;
  repeatPenalty?: number;
  /** Passed to the chat template, e.g. to turn thinking off. */
  templateKwargs?: Record<string, unknown>;
  contextSize: number;
}

const CONTEXT = 16384;

const spec = (id: string, source: string, file: string, extra: Partial<ModelSpec> = {}): ModelSpec => ({
  id,
  source,
  file,
  temperature: 0.1,
  contextSize: CONTEXT,
  ...extra,
});

const NO_THINKING = { enable_thinking: false };

export const MODELS: ModelSpec[] = [
  spec('lfm3-1.7b', 'LiquidAI/LFM3-1.7B-GGUF', 'LFM3-1.7B-Q4_K_M.gguf', { topK: 50, repeatPenalty: 1.1 }),
  spec('lfm2.5-1.2b-instruct', 'LiquidAI/LFM2.5-1.2B-Instruct-GGUF', 'LFM2.5-1.2B-Instruct-Q4_K_M.gguf'),
  spec('lfm2-1.2b-tool', 'LiquidAI/LFM2-1.2B-Tool-GGUF', 'LFM2-1.2B-Tool-Q4_K_M.gguf', { temperature: 0 }),
  spec('lfm2.5-350m', 'LiquidAI/LFM2.5-350M-GGUF', 'LFM2.5-350M-Q4_K_M.gguf'),
  spec('lfm2.5-8b-a1b', 'LiquidAI/LFM2.5-8B-A1B-GGUF', 'LFM2.5-8B-A1B-Q4_K_M.gguf'),
  spec('qwen3.5-2b', 'unsloth/Qwen3.5-2B-GGUF', 'Qwen3.5-2B-Q4_K_M.gguf', { templateKwargs: NO_THINKING }),
  spec('qwen3.5-4b', 'unsloth/Qwen3.5-4B-GGUF', 'Qwen3.5-4B-Q4_K_M.gguf', { templateKwargs: NO_THINKING }),
  spec('qwen3.5-9b', 'unsloth/Qwen3.5-9B-GGUF', 'Qwen3.5-9B-Q4_K_M.gguf', { templateKwargs: NO_THINKING }),
  spec('gemma-4-e4b', 'unsloth/gemma-4-E4B-it-GGUF', 'gemma-4-E4B-it-Q4_K_M.gguf'),
  spec('phi-4-mini', 'unsloth/Phi-4-mini-instruct-GGUF', 'Phi-4-mini-instruct-Q4_K_M.gguf'),
  // Added for the final round (2026-11-25). Chosen from vendor-reported BFCL V4 figures only to decide what to test; the
  // choice of the first ten models did not use them (docs/artigo-estrutura-experimento.md).
  spec('lfm2.5-2.6b', 'LiquidAI/LFM2.5-2.6B-GGUF', 'LFM2.5-2.6B-Q4_K_M.gguf'),
  spec('minicpm5-2b', 'openbmb/MiniCPM5-2B-GGUF', 'MiniCPM5-2B-Q4_K_M.gguf'),
  spec('granite-4.2-3b', 'ibm-granite/granite-4.2-3b-GGUF', 'granite-4.2-3b-Q4_K_M.gguf'),
  spec('spark-x2.6-4b', 'XHToken/Spark-X2.6-4B-GGUF', 'Spark-X2.6-4B-Q4_K_M.gguf'),
];

/**
 * The command line that starts llama-server for a model: every layer on the GPU, the chat template of the model
 * (--jinja, needed for tool calls) and a fixed seed.
 *
 * Usage:
 *   serverArgs(MODELS[0], 8089); // ['-m', 'F:\\...gguf', '--jinja', ...]
 */
export function serverArgs(model: ModelSpec, port: number, setup: RunSetup = DEFAULT_SETUP): string[] {
  const modelPath = path.join(setup.modelsDir, model.file);
  return chatServerArgs(
    { modelPath, contextSize: model.contextSize, device: setup.device, port },
    model.templateKwargs,
  );
}

/** Sampling sent with every request, from the model's card. */
export function samplingOf(model: ModelSpec): Record<string, number> {
  const sampling: Record<string, number> = { temperature: model.temperature, seed: 42 };
  if (model.topK !== undefined) sampling.top_k = model.topK;
  if (model.repeatPenalty !== undefined) sampling.repeat_penalty = model.repeatPenalty;
  return sampling;
}
