/**
 * What differs from one machine to another: where llama-server and the models are, which device runs them, and how the
 * setup is called in the record. Everything else in a run is the same on every machine, so results can be compared.
 */
export interface RunSetup {
  /** Path of llama-server. */
  server: string;
  modelsDir: string;
  /** The llama.cpp device (`Vulkan0`, `CUDA0`); empty lets llama.cpp choose. */
  device: string;
  /** For the record: `vulkan`, `cuda`... */
  backend: string;
  /** For the record: the llama.cpp build. */
  build: string;
  /** Where runs are written; empty means the folder next to the code. */
  runsDir: string;
}

/** The setup of the author's machine: a RX 580 through Vulkan. */
export const DEFAULT_SETUP: RunSetup = {
  server: 'F:/llm-lab/bin/b12425/llama-server.exe',
  modelsDir: 'F:/llm-lab/models',
  device: 'Vulkan0',
  backend: 'vulkan',
  build: 'b12425',
  runsDir: '',
};

type Env = Record<string, string | undefined>;

/**
 * The setup from environment variables, each falling back to the author's machine. A variable that is set to an empty
 * text is respected (LLAMA_DEVICE= means "no --device").
 *
 * Usage:
 *   setupFromEnv({ LLAMA_SERVER: '/content/llama/llama-server', LLAMA_MODELS_DIR: '/content/models', LLAMA_DEVICE: '' });
 */
export function setupFromEnv(env: Env): RunSetup {
  const pick = (name: string, fallback: string): string => env[name] ?? fallback;
  return {
    server: pick('LLAMA_SERVER', DEFAULT_SETUP.server),
    modelsDir: pick('LLAMA_MODELS_DIR', DEFAULT_SETUP.modelsDir),
    device: pick('LLAMA_DEVICE', DEFAULT_SETUP.device),
    backend: pick('LLAMA_BACKEND', DEFAULT_SETUP.backend),
    build: pick('LLAMA_BUILD', DEFAULT_SETUP.build),
    runsDir: pick('EVAL_RUNS_DIR', DEFAULT_SETUP.runsDir),
  };
}
