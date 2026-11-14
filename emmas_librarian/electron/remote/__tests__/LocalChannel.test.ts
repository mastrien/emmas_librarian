// A real HTTP server on loopback and the client the CLI uses, end to end.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import path from 'path';
import { IpcChannel } from '../../types';
import { CommandRegistry } from '../../../core/commands/CommandRegistry';
import { connectToRunningApp, httpChannelTransport } from '../../../core/cli/localChannelClient';
import { CLI_EXIT, runCli } from '../../../core/cli/cliRunner';
import { LocalChannel } from '../LocalChannel';
import { MAX_BODY_BYTES } from '../gatewayListener';

let commands: CommandRegistry;
let channel: LocalChannel;
let address: { port: number; token: string };
let ran: string[];

function post(
  route: string,
  token: string,
  body: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string }> {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const request = http.request(
      { host: '127.0.0.1', port: address.port, method: 'POST', path: route, headers },
      (response) => {
        let text = '';
        response.on('data', (chunk) => (text += chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, text }));
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

beforeEach(async () => {
  ran = [];
  commands = new CommandRegistry();
  commands.add(IpcChannel.PROJECTS_GET_ALL, () => [{ id: 1, name: 'Tese' }]);
  commands.add(IpcChannel.EXPORT_CSV, (id: number, filePath: string) => void ran.push(`export(${id}, ${filePath})`), {
    file: { at: 1, mode: 'save', describe: () => ({ title: 'Exportar', filters: [] }) },
  });
  commands.add(IpcChannel.PROJECTS_CREATE, () => {
    throw new Error('UNIQUE constraint failed: projects.name');
  });
  commands.add(IpcChannel.BACKUP_RESTORE_AUTO, () => void ran.push('restore'));
  channel = new LocalChannel(commands);
  address = await channel.start();
});

afterEach(() => channel.stop());

describe('LocalChannel', () => {
  it('answers a command to who holds the token of this run', async () => {
    const reply = await post(`/api/commands/${IpcChannel.PROJECTS_GET_ALL}`, address.token, '{}');

    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.text)).toEqual({ ok: true, result: [{ id: 1, name: 'Tese' }] });
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(reply.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuses another token', async () => {
    expect((await post(`/api/commands/${IpcChannel.PROJECTS_GET_ALL}`, 'outro', '{}')).status).toBe(401);
  });

  it('gives each run its own token and port', async () => {
    const other = new LocalChannel(commands);
    const second = await other.start();
    other.stop();

    expect(second.token).not.toBe(address.token);
    expect(second.port).not.toBe(address.port);
  });

  it('refuses a body over the limit without running anything', async () => {
    const reply = await post(`/api/commands/${IpcChannel.EXPORT_CSV}`, address.token, 'x'.repeat(MAX_BODY_BYTES + 1));

    expect(reply.status).toBe(413);
    expect(ran).toEqual([]);
  });

  it('stops answering once stopped', async () => {
    channel.stop();

    await expect(post('/api/ping', address.token, '')).rejects.toThrow();
  });
});

describe('the CLI through the open app', () => {
  const cli = (...argv: string[]) =>
    runCli(argv, () => connectToRunningApp(httpChannelTransport(address), '/home/ana/tese'));

  it('runs a command inside the app and prints its result', async () => {
    expect(await cli(IpcChannel.PROJECTS_GET_ALL)).toEqual({
      exitCode: CLI_EXIT.ok,
      stdout: '{"ok":true,"result":[{"id":1,"name":"Tese"}]}',
    });
  });

  it("makes the file path absolute from the terminal's folder before the app sees it", async () => {
    await cli(IpcChannel.EXPORT_CSV, '3', './artigos.csv');

    // path.resolve, so the expectation also holds on Windows, where the path gains a drive letter.
    expect(ran).toEqual([`export(3, ${path.resolve('/home/ana/tese', 'artigos.csv')})`]);
  });

  it('reports a failure of the command with the same code and exit status as without the app', async () => {
    const outcome = await cli(IpcChannel.PROJECTS_CREATE, 'Tese');

    expect(outcome.exitCode).toBe(CLI_EXIT.rejected);
    expect(JSON.parse(outcome.stderr!).error.code).toBe('ERR_DUPLICATE');
  });

  it('refuses what would replace the library the app has open, and lists the commands of the app', async () => {
    expect((await cli(IpcChannel.BACKUP_RESTORE_AUTO, 'emma_backup_2026-11-14.db.gz')).exitCode).toBe(
      CLI_EXIT.libraryInUse,
    );
    expect(ran).toEqual([]);

    const listed = JSON.parse((await cli('commands')).stdout!).result as { name: string }[];
    expect(listed).toContainEqual({ name: IpcChannel.EXPORT_CSV, file: { argument: 2, mode: 'save' } });
  });

  it('asks for the file path before calling the app', async () => {
    expect((await cli(IpcChannel.EXPORT_CSV, '3')).exitCode).toBe(CLI_EXIT.usage);
  });
});
