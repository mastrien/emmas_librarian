import { describe, it, expect } from 'vitest';
import { IpcChannel } from '../../../src/types';
import { CHANNEL_SURFACES, cliChannels, surfaceOf } from '../channelSurfaces';

describe('channel surfaces', () => {
  it('classifies every IpcChannel', () => {
    expect(Object.keys(CHANNEL_SURFACES).sort()).toEqual(Object.values(IpcChannel).sort());
  });

  it.each([
    [IpcChannel.PROJECTS_GET_ALL, 'cli'],
    [IpcChannel.EXPORT_CSV, 'cli'],
    [IpcChannel.BACKUP_RESTORE_MERGE, 'cli'],
    [IpcChannel.DIARY_SAVE, 'cli'],
    [IpcChannel.HIGHLIGHTS_GET, 'cli'],
    [IpcChannel.DIALOG_OPEN_FILE, 'gui-only'],
    [IpcChannel.PDF_GET, 'gui-only'],
    [IpcChannel.HIGHLIGHTS_CREATE, 'gui-only'],
    [IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, 'gui-only'],
    [IpcChannel.UPDATE_INSTALL, 'gui-only'],
  ] as const)('%s is %s', (channel, surface) => {
    expect(surfaceOf(channel)).toBe(surface);
  });

  it('offers a CLI everything but dialogs, the updater, opening outside the app, the LAN controls and the PDF reader', () => {
    const guiOnly = Object.values(IpcChannel).filter((channel) => !cliChannels().includes(channel));

    expect(guiOnly.sort()).toEqual(
      [
        IpcChannel.DIALOG_OPEN_FILE,
        IpcChannel.DIALOG_OPEN_MULTIPLE_FILES,
        IpcChannel.DIALOG_SAVE_FILE,
        IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL,
        IpcChannel.UPDATE_CHECK,
        IpcChannel.UPDATE_DOWNLOAD,
        IpcChannel.UPDATE_INSTALL,
        IpcChannel.UPDATE_GET_STATUS,
        IpcChannel.UPDATE_RESTORE_SNAPSHOT,
        IpcChannel.REMOTE_ACCESS_GET_STATUS,
        IpcChannel.REMOTE_ACCESS_SET_ENABLED,
        IpcChannel.REMOTE_ACCESS_START_PAIRING,
        IpcChannel.REMOTE_ACCESS_CANCEL_PAIRING,
        IpcChannel.REMOTE_ACCESS_REVOKE_DEVICE,
        IpcChannel.PDF_GET,
        IpcChannel.HIGHLIGHTS_CREATE,
        IpcChannel.HIGHLIGHTS_DELETE,
        IpcChannel.PENDING_HIGHLIGHTS_GET,
        IpcChannel.PENDING_HIGHLIGHTS_DELETE,
      ].sort(),
    );
  });
});
