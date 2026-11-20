// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentModelFile } from '../runtime/agentModels';
import { startAgentRuntime, type AgentRuntimeDeps } from '../runtime/agentRuntime';
import type { RunningServer } from '../runtime/serverProcess';
import { FakeModelHost } from './support/FakeModelHost';

const LISTING = 'Available devices:\n  CUDA0: NVIDIA L4 (22563 MiB, 22369 MiB free)\n';

/** Records every start and stop instead of spawning llama-server; `failOn` makes the nth start fail. */
class FakeServers {
  readonly started: Array<{ exe: string; args: string[]; port: number }> = [];
  readonly stopped: number[] = [];
  constructor(private readonly failOn: number = -1) {}

  readonly start = async (exe: string, args: string[], port: number): Promise<RunningServer> => {
    if (this.started.length === this.failOn) throw new Error('[ERR_SERVER_EXITED] fake failure');
    this.started.push({ exe, args, port });
    return {
      url: `http://127.0.0.1:${port}`,
      startupMs: 1,
      log: () => '',
      stop: async () => void this.stopped.push(port),
    };
  };
}

/** Says each model file is in place, and remembers which ones it was asked about. */
class FakeFiles {
  readonly asked: AgentModelFile[] = [];
  readonly ensure = async (model: AgentModelFile): Promise<string> => (this.asked.push(model), `/models/${model.file}`);
}

function deps(servers: FakeServers, over: Partial<AgentRuntimeDeps> = {}): AgentRuntimeDeps {
  let next = 9000;
  return {
    server: '/bin/llama-server',
    modelsDir: '/models',
    listDevices: async () => LISTING,
    fetch: new FakeModelHost(Buffer.from('x')).fetch,
    consent: async () => true,
    start: servers.start,
    findPort: async () => next++,
    ensure: new FakeFiles().ensure,
    ...over,
  };
}

describe('startAgentRuntime', () => {
  it('makes sure both files are there, chooses the device and starts the two servers on free ports', async () => {
    const servers = new FakeServers();
    const files = new FakeFiles();
    const runtime = await startAgentRuntime(deps(servers, { ensure: files.ensure }));

    expect(files.asked.map((model) => model.role)).toEqual(['chat', 'decision']);
    expect(runtime.device).toBe('CUDA0');
    expect(servers.started.map((s) => s.port).sort()).toEqual([9000, 9001]);
    const chat = servers.started.find((s) => s.args.includes('--jinja'));
    const decision = servers.started.find((s) => !s.args.includes('--jinja'));
    expect(chat?.args).toEqual(expect.arrayContaining(['--device', 'CUDA0', '-c', '16384']));
    expect(decision?.args).toEqual(expect.arrayContaining(['-ub', '4096']));
    expect(chat?.exe).toBe('/bin/llama-server');
  });

  it('runs on the processor when no device has room', async () => {
    const servers = new FakeServers();
    const runtime = await startAgentRuntime(deps(servers, { listDevices: async () => 'no devices' }));
    expect(runtime.device).toBe('');
    expect(servers.started.every((s) => !s.args.includes('--device'))).toBe(true);
  });

  it('stops both servers with stop()', async () => {
    const servers = new FakeServers();
    const runtime = await startAgentRuntime(deps(servers));
    await runtime.stop();
    expect(servers.stopped.sort()).toEqual([9000, 9001]);
  });

  it('stops the server that did start when the other one fails, and passes the error on', async () => {
    const servers = new FakeServers(1);
    await expect(startAgentRuntime(deps(servers))).rejects.toThrow(/ERR_SERVER_EXITED/);
    expect(servers.stopped).toHaveLength(1);
  });

  it('starts nothing when a download is declined', async () => {
    const servers = new FakeServers();
    const declined = async (): Promise<string> => {
      throw new Error('[ERR_DOWNLOAD_DECLINED] declined');
    };
    await expect(startAgentRuntime(deps(servers, { ensure: declined }))).rejects.toThrow(/ERR_DOWNLOAD_DECLINED/);
    expect(servers.started).toEqual([]);
  });
});
