/** A model file the agent downloads once: where from, how big and which bytes it must be. */
export interface AgentModelFile {
  id: string;
  role: 'chat' | 'decision';
  file: string;
  url: string;
  sizeBytes: number;
  /** Of the whole file, as the host publishes it (Hugging Face's LFS id). */
  sha256: string;
  contextSize: number;
  license: string;
  licenseUrl: string;
}

const LFM_LICENSE = { license: 'LFM Open License v1.0', licenseUrl: 'https://www.liquid.ai/lfm-license' };

/** The pair that scored best (docs/avaliacao-modelos.md); the licenses are read in docs/agente.md (#196). */
export const AGENT_MODELS: readonly AgentModelFile[] = [
  {
    id: 'lfm3-1.7b',
    role: 'chat',
    file: 'LFM3-1.7B-Q4_K_M.gguf',
    url: 'https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/resolve/main/LFM3-1.7B-Q4_K_M.gguf',
    sizeBytes: 1099627808,
    sha256: '3793e1e6e2266919d6e015287221b41100175a98eddaba92e111aed3b05c93c4',
    contextSize: 16384,
    ...LFM_LICENSE,
  },
  {
    id: 'd1-2b',
    role: 'decision',
    file: 'd1-2B-Q4_K_M.gguf',
    url: 'https://huggingface.co/LiquidAI/d1-2B-GGUF/resolve/main/d1-2B-Q4_K_M.gguf',
    sizeBytes: 1099629888,
    sha256: 'adca5789ad30ae6027e8e936749bb9f19673097492ab26fa1c5b69643ca50b4b',
    contextSize: 4096,
    ...LFM_LICENSE,
  },
];

/**
 * The model of a role.
 *
 * Usage:
 *   agentModel('chat').file; // 'LFM3-1.7B-Q4_K_M.gguf'
 */
export function agentModel(role: AgentModelFile['role']): AgentModelFile {
  const found = AGENT_MODELS.find((model) => model.role === role);
  if (!found)
    throw new Error(`[ERR_NO_AGENT_MODEL] Offending value: role ${JSON.stringify(role)}. Expected chat or decision.`);
  return found;
}
