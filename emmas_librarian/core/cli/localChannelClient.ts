import http from 'http';
import path from 'path';
import { CommandRegistry } from '../commands/CommandRegistry';
import type { TerminalCommandInfo } from '../commands/terminalCommands';
import { AppError, type ErrorType } from '../errors/AppError';
import type { LocalChannelAddress } from './appRunningMarker';
import type { OpenedCliHost } from './cliRunner';

interface ChannelReply {
  ok: boolean;
  result?: unknown;
  error?: { code: string; type: ErrorType; message: string };
}

/** Sends one request to the app's local channel and answers the parsed reply; replaced by a fake in tests. */
export type ChannelTransport = (method: 'GET' | 'POST', route: string, body?: object) => Promise<ChannelReply>;

/**
 * The real transport: HTTP to 127.0.0.1, with the token of this run of the app. No timeout: a command
 * (an AI extraction, a search) may legitimately take minutes.
 *
 * Usage:
 *   const send = httpChannelTransport({ port, token });
 *   await send('POST', '/api/commands/projects:getAll', { args: [] });
 */
export function httpChannelTransport({ port, token }: LocalChannelAddress): ChannelTransport {
  return (method, route, body) =>
    new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : '';
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const request = http.request({ host: '127.0.0.1', port, method, path: route, headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as ChannelReply));
      });
      request.on('error', reject);
      request.end(payload);
    });
}

function resultOf(reply: ChannelReply): unknown {
  if (reply.ok) return reply.result;
  const { code, type, message } = reply.error ?? { code: 'ERR_INTERNAL', type: 'SYSTEM_ERROR' as const, message: '' };
  throw new AppError(code, type, message);
}

// The app resolves relative paths against its own folder, not the terminal's: the file a command reads
// or writes is made absolute here, where "./artigos.csv" means what the person meant.
function withAbsoluteFile(args: unknown[], at: number, cwd: string): unknown[] {
  const given = args[at];
  if (typeof given !== 'string' || given === '') return args;
  return args.map((arg, index) => (index === at ? path.resolve(cwd, given) : arg));
}

function proxyCommand(registry: CommandRegistry, info: TerminalCommandInfo, send: ChannelTransport, cwd: string): void {
  const at = info.file ? info.file.argument - 1 : -1;
  const run = async (...args: unknown[]) => {
    const sent = at >= 0 ? withAbsoluteFile(args, at, cwd) : args;
    return resultOf(await send('POST', `/api/commands/${encodeURIComponent(info.name)}`, { args: sent }));
  };
  const describe = () => ({ title: info.name, filters: [] });
  registry.add(info.name, run, info.file ? { file: { at, mode: info.file.mode, describe } } : {});
}

/**
 * A CLI host whose commands run inside the open app, through its local channel, instead of on a second
 * connection to the database. It rejects when the app does not answer, so the caller can open the
 * library itself.
 *
 * Usage:
 *   const host = await connectToRunningApp(httpChannelTransport(channel), process.cwd());
 *   await runCliRequest(request, host);
 */
export async function connectToRunningApp(send: ChannelTransport, cwd: string): Promise<OpenedCliHost> {
  const listed = resultOf(await send('GET', '/api/commands')) as TerminalCommandInfo[];
  const commands = new CommandRegistry();
  for (const info of listed) proxyCommand(commands, info, send, cwd);
  return { commands, isAppRunning: () => true, close: () => undefined };
}
