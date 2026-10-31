// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { registerPrismaHandlers, tablePathFor } from '../../ipc/handlers/prismaHandlers';
import { IpcChannel } from '../../types';

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() } }));

class RecordingRegistrar {
  public handlers = new Map<string, (...args: unknown[]) => unknown>();
  handle(channel: string, listener: (...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }
}

let db: DatabaseAdapter;
let projectId: number;

beforeEach(() => {
  db = new DatabaseAdapter(':memory:');
  projectId = db.createProject('Revisão').id;
});

afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
});

describe('PRISMA numbers typed by hand (#50), against real SQLite', () => {
  it('keeps a number with the date it was set, replaces it, and clears it with null', () => {
    const first = db.prismaManualRepo.setCount(projectId, 'other_sources', 2);
    const replaced = db.prismaManualRepo.setCount(projectId, 'other_sources', 5);
    const cleared = db.prismaManualRepo.setCount(projectId, 'other_sources', null);

    expect(first).toEqual([{ count_key: 'other_sources', value: 2, updated_at: expect.any(String) }]);
    expect(replaced.map((c) => c.value)).toEqual([5]);
    expect(cleared).toEqual([]);
  });

  it('keeps each project its own numbers', () => {
    const other = db.createProject('Outra').id;
    db.prismaManualRepo.setCount(other, 'other_sources', 9);

    expect(db.prismaManualRepo.listCounts(projectId)).toEqual([]);
  });

  it.each([
    ['other_sources', -1],
    ['other_sources', 1.5],
    ['registers', 3],
  ])('refuses %s = %s, outside the expected shape', (key, value) => {
    expect(() => db.prismaManualRepo.setCount(projectId, key as never, value)).toThrowError(
      /ERR_INVALID_PRISMA.*Expected shape/,
    );
    expect(db.prismaManualRepo.listCounts(projectId)).toEqual([]);
  });
});

describe('PRISMA IPC channels (#50)', () => {
  let dir: string;
  let call: (channel: string, ...args: unknown[]) => unknown;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-prisma-'));
    const ipc = new RecordingRegistrar();
    registerPrismaHandlers(ipc as never, db);
    call = (channel, ...args) => ipc.handlers.get(channel)!({}, ...args);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('sets and reads the hand-typed numbers', async () => {
    await call(IpcChannel.PRISMA_MANUAL_SET, projectId, 'other_sources', 3);

    expect(await call(IpcChannel.PRISMA_MANUAL_GET, projectId)).toMatchObject([
      { count_key: 'other_sources', value: 3 },
    ]);
  });

  it('saves the SVG and its data table beside it, the table with a byte order mark for Excel', async () => {
    const target = path.join(dir, 'diagrama.svg');
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', target);

    const saved = await call(IpcChannel.EXPORT_PRISMA, projectId, 'svg', '<svg>n = 11</svg>', 'Caixa;n\nIncluídos;11');

    expect(saved).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('<svg>n = 11</svg>');
    expect(fs.readFileSync(path.join(dir, 'diagrama_dados.csv'), 'utf8')).toBe('﻿Caixa;n\nIncluídos;11');
  });

  it('writes a PNG from the base64 the renderer sends', async () => {
    const target = path.join(dir, 'diagrama.png');
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', target);

    await call(IpcChannel.EXPORT_PRISMA, projectId, 'png', Buffer.from('PNGDATA').toString('base64'), 'x');

    expect(fs.readFileSync(target, 'utf8')).toBe('PNGDATA');
  });

  it('refuses another image format, and an unknown project', async () => {
    await expect(call(IpcChannel.EXPORT_PRISMA, projectId, 'pdf', '', '')).rejects.toThrow();
    await expect(call(IpcChannel.EXPORT_PRISMA, 999, 'svg', '', '')).rejects.toThrow();
  });

  it('names the table after the image', () => {
    expect(tablePathFor(path.join('out', 'prisma.png'))).toBe(path.join('out', 'prisma_dados.csv'));
  });
});
