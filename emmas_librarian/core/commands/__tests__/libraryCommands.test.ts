// The core's composition root with a real library in a temp folder: what a CLI or the LAN server will start from.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IpcChannel, type Project } from '../../../src/types';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { appPathsIn, type AppPaths } from '../../ports/AppPaths';
import { FakeAppRuntime } from '../../ports/__tests__/fakes/FakeAppRuntime';
import type { CommandRegistry } from '../CommandRegistry';
import { cliChannels, surfaceOf } from '../channelSurfaces';
import { buildLibraryCommands } from '../libraryCommands';

// What only the desktop app can do: these channels have no command in the core.
const DESKTOP_ONLY = [
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
];

let workDir: string;
let paths: AppPaths;
let db: DatabaseAdapter;
let commands: CommandRegistry;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-library-'));
  paths = appPathsIn(path.join(workDir, 'userData'));
  fs.mkdirSync(paths.userData);
  db = new DatabaseAdapter(paths.dbPath);
  ({ commands } = buildLibraryCommands(db, { paths, runtime: new FakeAppRuntime('3.2.1'), env: {} }));
});

afterEach(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('buildLibraryCommands', () => {
  it('registers a command for every IpcChannel except what only the desktop app can do', () => {
    const expected = Object.values(IpcChannel).filter((channel) => !DESKTOP_ONLY.includes(channel));

    expect(commands.names().sort()).toEqual(expected.sort());
  });

  it('has a command behind every channel classified for the CLI, and none of the desktop-only ones is', () => {
    expect(cliChannels().filter((channel) => !commands.has(channel))).toEqual([]);
    expect(DESKTOP_ONLY.map(surfaceOf)).toEqual(DESKTOP_ONLY.map(() => 'gui-only'));
  });

  it('declares the file argument of every command that reads or writes a file the person chooses', () => {
    const withFile = commands
      .list()
      .filter((command) => command.file)
      .map((command) => `${command.name} ${command.file!.mode}@${command.file!.at}`);

    expect(withFile.sort()).toEqual(
      [
        `${IpcChannel.EXPORT_CSV} save@1`,
        `${IpcChannel.EXPORT_XLSX} save@1`,
        `${IpcChannel.EXPORT_BIBLIOSHINY} save@1`,
        `${IpcChannel.EXPORT_SEARCH_REPORT} save@2`,
        `${IpcChannel.EXPORT_PRISMA} save@4`,
        `${IpcChannel.SYNC_EXPORT_PROJECT} save@1`,
        `${IpcChannel.SYNC_IMPORT_PROJECT} open@0`,
        `${IpcChannel.BACKUP_EXPORT} save@0`,
        `${IpcChannel.BACKUP_RESTORE_OVERRIDE} open@0`,
        `${IpcChannel.BACKUP_RESTORE_MERGE} open@0`,
        `${IpcChannel.CATEGORIES_READ_SET_FILE} open@0`,
      ].sort(),
    );
  });

  it('runs commands against the library it was given, with no shell around it', async () => {
    const created = (await commands.run(IpcChannel.PROJECTS_CREATE, 'Tese')) as Project;
    const target = path.join(workDir, 'tese.emmapcarc');

    expect(await commands.run(IpcChannel.PROJECTS_GET_ALL)).toMatchObject([{ id: created.id, name: 'Tese' }]);
    expect(await commands.run(IpcChannel.SYNC_EXPORT_PROJECT, created.id, target)).toBe(target);
    expect(fs.existsSync(target)).toBe(true);
    expect(await commands.run(IpcChannel.APP_GET_VERSION)).toBe('3.2.1');
  });

  it('answers the canned AI extraction when the host asks for the E2E mocks', async () => {
    const e2e = buildLibraryCommands(db, {
      paths,
      runtime: new FakeAppRuntime(),
      env: { E2E_MOCK_AI_EXTRACTION: 'true' },
    }).commands;

    expect(await e2e.run(IpcChannel.AI_MASSIVE_EXTRACTION, 1, ['Qual o método?'])).toEqual([
      { question: 'Qual o método?', answer: 'This is the E2E mock answer.', confidence: 0.95 },
    ]);
  });
});
