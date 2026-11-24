// @vitest-environment node
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { connectToRunningApp, type ChannelTransport } from '../localChannelClient';

/** The app's local channel, scripted: answers the listing and each command with what the test prepared. */
class ScriptedChannel {
  readonly sent: Array<{ method: string; route: string; body?: unknown }> = [];
  constructor(
    private readonly commands: unknown[],
    private readonly answer: unknown = { ok: true, result: 'feito' },
  ) {}
  readonly transport: ChannelTransport = async (method, route, body) => {
    this.sent.push({ method, route, body });
    return (route === '/api/commands' ? { ok: true, result: this.commands } : this.answer) as never;
  };
}

describe('connectToRunningApp', () => {
  it('runs a command inside the app through the channel, with the arguments it was given', async () => {
    const channel = new ScriptedChannel([{ name: 'projects:getAll' }]);
    const host = await connectToRunningApp(channel.transport, '/pasta');
    expect(await host.commands.get('projects:getAll').run(1, 'a')).toBe('feito');
    expect(channel.sent[1]).toEqual({
      method: 'POST',
      route: '/api/commands/projects%3AgetAll',
      body: { args: [1, 'a'] },
    });
    expect(host.isAppRunning()).toBe(true);
  });

  it('makes the file argument absolute from where the terminal is, since the app resolves from its own folder', async () => {
    const channel = new ScriptedChannel([{ name: 'export:csv', args: [], file: { argument: 2, mode: 'save' } }]);
    const host = await connectToRunningApp(channel.transport, '/pasta');
    await host.commands.get('export:csv').run(1, './artigos.csv');
    expect((channel.sent[1].body as { args: unknown[] }).args[1]).toBe(path.resolve('/pasta', './artigos.csv'));
  });

  it('leaves the file argument alone when it is empty or not text', async () => {
    const channel = new ScriptedChannel([{ name: 'export:csv', file: { argument: 2, mode: 'save' } }]);
    const host = await connectToRunningApp(channel.transport, '/pasta');
    await host.commands.get('export:csv').run(1, '');
    expect((channel.sent[1].body as { args: unknown[] }).args).toEqual([1, '']);
  });

  it('turns an error of the app into the same error here, and an error with no details into an internal one', async () => {
    const withError = new ScriptedChannel([{ name: 'a:b' }], {
      ok: false,
      error: { code: 'ERR_X', type: 'USER_ERROR', message: 'não' },
    });
    const host = await connectToRunningApp(withError.transport, '/');
    await expect(host.commands.get('a:b').run()).rejects.toMatchObject({ code: 'ERR_X', type: 'USER_ERROR' });
    const bare = new ScriptedChannel([{ name: 'a:b' }], { ok: false });
    const bareHost = await connectToRunningApp(bare.transport, '/');
    await expect(bareHost.commands.get('a:b').run()).rejects.toMatchObject({ code: 'ERR_INTERNAL' });
  });
});
