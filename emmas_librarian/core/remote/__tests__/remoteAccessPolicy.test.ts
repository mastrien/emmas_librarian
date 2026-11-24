import { describe, it, expect, beforeEach } from 'vitest';
import { IpcChannel } from '../../../src/types';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { CHANNEL_SURFACES } from '../../commands/channelSurfaces';
import {
  authorizeRemoteCommand,
  DEVICE_READ_CHANNELS,
  DEVICE_WRITE_CHANNELS,
  type RemotePrincipal,
} from '../remoteAccessPolicy';

const device: RemotePrincipal = { kind: 'device', deviceId: 'd1' };
const local: RemotePrincipal = { kind: 'local' };

describe('what a paired device may run', () => {
  it('writes only the diary, quick access links and article categories', () => {
    expect([...DEVICE_WRITE_CHANNELS].sort()).toEqual(
      [
        IpcChannel.DIARY_SAVE,
        IpcChannel.PROJECT_DOCUMENTS_CREATE,
        IpcChannel.PROJECT_DOCUMENTS_MARK_OPENED,
        IpcChannel.CATEGORIES_SET_ARTICLE,
      ].sort(),
    );
  });

  // The API keys live in the settings; backups and the trash can destroy the library.
  it.each([
    IpcChannel.SETTINGS_GET,
    IpcChannel.SETTINGS_SET,
    IpcChannel.BACKUP_EXPORT,
    IpcChannel.BACKUP_RESTORE_OVERRIDE,
    IpcChannel.SYNC_EXPORT_PROJECT,
    IpcChannel.TRASH_EMPTY,
    IpcChannel.PROJECTS_DELETE,
    IpcChannel.PDF_UPLOAD,
    IpcChannel.PDF_LIBRARY_LIST,
    IpcChannel.AI_MODEL_CONFIG_GET_ALL,
    IpcChannel.SEARCH_PREVIEW,
    IpcChannel.EXPORT_CSV,
  ])('never reaches %s', (channel) => {
    expect([...DEVICE_READ_CHANNELS, ...DEVICE_WRITE_CHANNELS]).not.toContain(channel);
  });

  it('lists only channels that exist, each once', () => {
    const listed = [...DEVICE_READ_CHANNELS, ...DEVICE_WRITE_CHANNELS];

    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.filter((channel) => !(channel in CHANNEL_SURFACES))).toEqual([]);
  });
});

describe('authorizeRemoteCommand', () => {
  let commands: CommandRegistry;
  const allow = (principal: RemotePrincipal, name: string, args: unknown[] = []) =>
    authorizeRemoteCommand(commands, principal, name, args);
  const refusal = (principal: RemotePrincipal, name: string) => {
    try {
      allow(principal, name);
      return null;
    } catch (error) {
      return (error as { code: string }).code;
    }
  };

  beforeEach(() => {
    commands = new CommandRegistry();
    for (const channel of Object.values(IpcChannel)) commands.add(channel, () => channel);
  });

  it('lets a device run a listed command with its arguments untouched', () => {
    const { command, args } = allow(device, IpcChannel.DIARY_SAVE, [3, '2026-11-14', 'texto']);

    expect(command.name).toBe(IpcChannel.DIARY_SAVE);
    expect(args).toEqual([3, '2026-11-14', 'texto']);
  });

  it('refuses a device anything off its list', () => {
    expect(refusal(device, IpcChannel.SETTINGS_GET)).toBe('ERR_REMOTE_FORBIDDEN');
    expect(refusal(device, IpcChannel.BACKUP_RESTORE_OVERRIDE)).toBe('ERR_REMOTE_FORBIDDEN');
  });

  // A phone must not make the desktop copy a file of its own disk into the library.
  it('drops the desktop file path from a quick access document a device creates', () => {
    const { args } = allow(device, IpcChannel.PROJECT_DOCUMENTS_CREATE, [
      3,
      'Edital',
      'https://x',
      '/etc/passwd',
      'Normas',
    ]);

    expect(args).toEqual([3, 'Edital', 'https://x', null, 'Normas']);
  });

  it('refuses a device a listed command that takes a file of the desktop', () => {
    const withFile = new CommandRegistry();
    const file = { at: 0, mode: 'open' as const, describe: () => ({ title: 'x', filters: [] }) };
    withFile.add(IpcChannel.DIARY_GET_ALL, () => 1, { file });

    expect(() => authorizeRemoteCommand(withFile, device, IpcChannel.DIARY_GET_ALL, [])).toThrow(
      'ERR_REMOTE_FORBIDDEN',
    );
  });

  it('lets the local CLI run what a terminal can run, files included', () => {
    expect(allow(local, IpcChannel.SETTINGS_GET, ['theme']).args).toEqual(['theme']);
    expect(allow(local, IpcChannel.EXPORT_CSV, [3, './a.csv']).command.name).toBe(IpcChannel.EXPORT_CSV);
  });

  it('refuses the local CLI what only the app can do and what would replace the open library', () => {
    expect(refusal(local, IpcChannel.PDF_GET)).toBe('ERR_GUI_ONLY');
    expect(refusal(local, IpcChannel.BACKUP_RESTORE_AUTO)).toBe('ERR_LIBRARY_IN_USE');
  });

  it('reports an unknown command the same way to everyone', () => {
    expect(refusal(device, 'nope')).toBe('ERR_UNKNOWN_COMMAND');
    expect(refusal(local, 'nope')).toBe('ERR_UNKNOWN_COMMAND');
  });
});
