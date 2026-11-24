// @vitest-environment node
import net from 'node:net';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { startServer } from '../eval/run/serverProcess';

/** A port the operating system says nobody uses, so two runs never fight for one. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

const FAKE = path.join(__dirname, 'support', 'fakeLlamaServer.cjs');

describe('startServer, with a stand-in for llama-server', () => {
  it('waits until /health answers, gives the address and the log, and stops the process', async () => {
    const port = await findFreePort();
    const server = await startServer(process.execPath, [FAKE, String(port), '300'], port, 10000);
    try {
      expect(server.url).toBe(`http://127.0.0.1:${port}`);
      expect(server.startupMs).toBeGreaterThanOrEqual(250);
      expect((await fetch(`${server.url}/health`)).status).toBe(200);
    } finally {
      await server.stop();
    }
    await expect(fetch(`${server.url}/health`)).rejects.toThrow();
  });

  it('fails with the end of the log when the process dies before it is ready', async () => {
    const port = await findFreePort();
    await expect(startServer(process.execPath, [FAKE, String(port), '0', 'exit'], port, 10000)).rejects.toThrow(
      /\[ERR_SERVER_EXITED\].*model file not found/s,
    );
  });

  it('gives up with the address it waited for when /health never answers in time', async () => {
    const port = await findFreePort();
    const failure = await startServer(process.execPath, [FAKE, String(port), '60000'], port, 1500).catch(
      (e: Error) => e,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('ERR_SERVER_TIMEOUT');
    expect((failure as Error).message).toContain('1500 ms');
    expect((failure as Error).message).toContain(`http://127.0.0.1:${port}/health`);
  });
});
