import { spawn, execFileSync, type ChildProcess } from 'child_process';

export interface RunningServer {
  url: string;
  startupMs: number;
  log: () => string;
  stop: () => Promise<void>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function isHealthy(url: string): Promise<boolean> {
  try {
    return (await fetch(`${url}/health`)).ok;
  } catch {
    return false;
  }
}

/**
 * Starts llama-server and waits until it can answer. If the process dies first, the error carries the end of its log.
 *
 * Usage:
 *   const server = await startServer('F:\\llm-lab\\bin\\b12425\\llama-server.exe', serverArgs(model, 8089), 8089);
 *   // ...use server.url...  await server.stop();
 */
export async function startServer(
  exe: string,
  args: string[],
  port: number,
  timeoutMs = 240000,
): Promise<RunningServer> {
  const started = Date.now();
  let output = '';
  const child: ChildProcess = spawn(exe, args, { windowsHide: true });
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  let exited = false;
  child.on('exit', () => (exited = true));
  const url = `http://127.0.0.1:${port}`;
  while (Date.now() - started < timeoutMs) {
    if (exited)
      throw new Error(
        `[ERR_SERVER_EXITED] llama-server stopped before it was ready. Expected it to serve ${url}. Log end: ${output.slice(-800)}`,
      );
    if (await isHealthy(url))
      return { url, startupMs: Date.now() - started, log: () => output, stop: () => stopProcess(child) };
    await sleep(500);
  }
  child.kill();
  throw new Error(
    `[ERR_SERVER_TIMEOUT] llama-server was not ready in ${timeoutMs} ms. Expected ${url}/health to answer. Log end: ${output.slice(-800)}`,
  );
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return;
  // On Windows taskkill /T also ends what the server started; a plain kill leaves the Vulkan memory held.
  if (process.platform === 'win32')
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
  await sleep(500);
}
