// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { serveUpdates, type UpdateServer } from '../updateServer';

const PORT = 18765;
let folder: string;
let server: UpdateServer;

beforeEach(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-update-server-'));
  fs.writeFileSync(path.join(folder, 'latest.yml'), 'version: 9.0.1\n');
  fs.writeFileSync(path.join(folder, "Emma's Librarian Setup 9.0.1.exe"), 'installer bytes');
  fs.writeFileSync(path.join(folder, "Emma's Librarian Setup 9.0.1.exe.blockmap"), 'blockmap');
  server = await serveUpdates(folder, PORT);
});

afterEach(async () => {
  await server.close();
  fs.rmSync(folder, { recursive: true, force: true });
});

const get = async (urlPath: string) => {
  const res = await fetch(`http://127.0.0.1:${PORT}${urlPath}`);
  return { status: res.status, body: res.status === 200 ? await res.text() : '' };
};

describe('serveUpdates', () => {
  it('serves latest.yml and an installer whose name the client URL-encodes', async () => {
    expect(await get('/latest.yml')).toEqual({ status: 200, body: 'version: 9.0.1\n' });
    expect(await get('/Emma%27s%20Librarian%20Setup%209.0.1.exe')).toEqual({ status: 200, body: 'installer bytes' });
  });

  it('answers 404 for blockmaps, so the app downloads the full installer', async () => {
    expect((await get('/Emma%27s%20Librarian%20Setup%209.0.1.exe.blockmap')).status).toBe(404);
  });

  it('answers 404 for unknown files and for paths outside the folder', async () => {
    expect((await get('/nope.exe')).status).toBe(404);
    expect((await get('/..%2F..%2Fsecret.txt')).status).toBe(404);
  });

  it('records what was asked for, decoded', async () => {
    await get('/latest.yml');
    await get('/Emma%27s%20Librarian%20Setup%209.0.1.exe');

    expect(server.requests).toEqual(['latest.yml', "Emma's Librarian Setup 9.0.1.exe"]);
  });

  it('answers 400 to a malformed path and keeps serving', async () => {
    expect((await get('/%E0%A4%A')).status).toBe(400);

    expect(await get('/latest.yml')).toEqual({ status: 200, body: 'version: 9.0.1\n' });
  });

  it('answers 500 when the file cannot be read after it was found', async () => {
    // Like fs.createReadStream on a file locked or deleted after the stat: created fine, fails while opening.
    vi.spyOn(fs, 'createReadStream').mockImplementationOnce(() => {
      const unreadable = new Readable({ read: () => undefined });
      setImmediate(() => unreadable.destroy(new Error('EBUSY: resource busy or locked')));
      return unreadable as unknown as fs.ReadStream;
    });

    expect((await get('/latest.yml')).status).toBe(500);
    vi.restoreAllMocks();
  });
});
