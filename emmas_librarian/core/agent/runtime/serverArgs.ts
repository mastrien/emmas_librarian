export interface ServerLaunch {
  modelPath: string;
  contextSize: number;
  /** The llama.cpp device (`Vulkan0`, `CUDA0`); empty lets llama.cpp choose. */
  device: string;
  port: number;
}

function common(launch: ServerLaunch): string[] {
  const args = ['-m', launch.modelPath, '-ngl', '99', '-c', String(launch.contextSize)];
  return launch.device ? [...args, '--device', launch.device] : args;
}

const tail = (port: number): string[] => ['--port', String(port), '--host', '127.0.0.1', '--no-webui'];

/**
 * The command line of a chat model: every layer on the GPU, the model's own chat template (--jinja, needed for tool
 * calls) and a fixed seed, so the same question gets the same answer.
 *
 * Usage:
 *   chatServerArgs({ modelPath, contextSize: 16384, device: 'Vulkan0', port: 8089 }, { enable_thinking: false });
 */
export function chatServerArgs(launch: ServerLaunch, templateKwargs?: Record<string, unknown>): string[] {
  const args = [...common(launch), '--jinja', ...tail(launch.port), '--seed', '42'];
  return templateKwargs ? [...args, '--chat-template-kwargs', JSON.stringify(templateKwargs)] : args;
}

/**
 * The command line of a decision model: no chat template, and a batch as big as the context, because the whole request
 * (every option) is read in one pass and llama-server answers 500 when it does not fit the default 512.
 *
 * Usage:
 *   decisionServerArgs({ modelPath, contextSize: 4096, device: '', port: 8090 });
 */
export function decisionServerArgs(launch: ServerLaunch): string[] {
  const batch = String(launch.contextSize);
  return [...common(launch), '-b', batch, '-ub', batch, ...tail(launch.port)];
}
