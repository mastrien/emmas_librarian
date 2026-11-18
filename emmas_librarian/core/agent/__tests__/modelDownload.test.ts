// @vitest-environment node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentModelFile } from '../runtime/agentModels';
import { ensureModelFile, sha256Of } from '../runtime/modelDownload';
import { FakeModelHost } from './support/FakeModelHost';

const CONTENT = Buffer.from('um modelo de mentira, com bytes suficientes para cortar no meio '.repeat(40));
const model: AgentModelFile = {
  id: 'fake',
  role: 'chat',
  file: 'fake.gguf',
  url: 'https://host.test/fake.gguf',
  sizeBytes: CONTENT.length,
  sha256: createHash('sha256').update(CONTENT).digest('hex'),
  contextSize: 1024,
  license: 'test',
  licenseUrl: 'https://host.test/license',
};

let dir: string;
const yes = async (): Promise<boolean> => true;
beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-model-'))));
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('ensureModelFile', () => {
  it('downloads the file after a yes, reports the progress, and checks it', async () => {
    const host = new FakeModelHost(CONTENT);
    const seen: number[] = [];
    const file = await ensureModelFile(model, {
      dir,
      fetch: host.fetch,
      consent: yes,
      onProgress: (done) => seen.push(done),
    });

    expect(file).toBe(path.join(dir, 'fake.gguf'));
    expect(fs.readFileSync(file).equals(CONTENT)).toBe(true);
    expect(fs.existsSync(`${file}.part`)).toBe(false);
    expect(seen.at(-1)).toBe(CONTENT.length);
    expect(host.requests).toEqual([{ url: model.url, range: undefined }]);
  });

  it('asks the question with the model, and downloads nothing when the answer is no', async () => {
    const host = new FakeModelHost(CONTENT);
    const asked: string[] = [];
    await expect(
      ensureModelFile(model, {
        dir,
        fetch: host.fetch,
        consent: async (m) => (asked.push(m.file), false),
      }),
    ).rejects.toThrow(/\[ERR_DOWNLOAD_DECLINED\].*fake\.gguf.*Expected a yes/s);
    expect(asked).toEqual(['fake.gguf']);
    expect(host.requests).toEqual([]);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('does not ask or download when the file is there and matches', async () => {
    fs.writeFileSync(path.join(dir, 'fake.gguf'), CONTENT);
    const host = new FakeModelHost(CONTENT);
    const consent = async (): Promise<boolean> => {
      throw new Error('should not be asked');
    };
    await ensureModelFile(model, { dir, fetch: host.fetch, consent });
    expect(host.requests).toEqual([]);
  });

  it('refuses a file that is there but different, and leaves it as it is', async () => {
    const target = path.join(dir, 'fake.gguf');
    fs.writeFileSync(target, 'outro conteúdo');
    await expect(
      ensureModelFile(model, { dir, fetch: new FakeModelHost(CONTENT).fetch, consent: yes }),
    ).rejects.toThrow(/\[ERR_MODEL_HASH\].*Expected sha256 [0-9a-f]{64}/s);
    expect(fs.readFileSync(target, 'utf8')).toBe('outro conteúdo');
  });

  it('resumes a cut download from the bytes it has, asking only for the rest', async () => {
    const cut = 700;
    fs.writeFileSync(path.join(dir, 'fake.gguf.part'), CONTENT.subarray(0, cut));
    const host = new FakeModelHost(CONTENT);
    const file = await ensureModelFile(model, { dir, fetch: host.fetch, consent: yes });

    expect(host.requests[0].range).toBe(`bytes=${cut}-`);
    expect(fs.readFileSync(file).equals(CONTENT)).toBe(true);
  });

  it('starts over when the host ignores the range and sends the whole file', async () => {
    fs.writeFileSync(path.join(dir, 'fake.gguf.part'), CONTENT.subarray(0, 300));
    const host = new FakeModelHost(CONTENT, { ignoreRange: true });
    const file = await ensureModelFile(model, { dir, fetch: host.fetch, consent: yes });
    expect(fs.readFileSync(file).equals(CONTENT)).toBe(true);
  });

  it('throws away a partial file bigger than the model and downloads from the start', async () => {
    fs.writeFileSync(path.join(dir, 'fake.gguf.part'), Buffer.concat([CONTENT, CONTENT]));
    const host = new FakeModelHost(CONTENT);
    await ensureModelFile(model, { dir, fetch: host.fetch, consent: yes });
    expect(host.requests[0].range).toBeUndefined();
  });

  // Bytes that arrive wrong must never be kept as the model.
  it('deletes the download and says both hashes when the bytes are not the published ones', async () => {
    const wrong = Buffer.concat([CONTENT.subarray(0, CONTENT.length - 1), Buffer.from('X')]);
    await expect(ensureModelFile(model, { dir, fetch: new FakeModelHost(wrong).fetch, consent: yes })).rejects.toThrow(
      /\[ERR_MODEL_HASH\].*sha256 [0-9a-f]{64} of .*Expected sha256 [0-9a-f]{64}/s,
    );
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('fails with the status and the address when the host refuses', async () => {
    await expect(
      ensureModelFile(model, { dir, fetch: new FakeModelHost(CONTENT, { status: 404 }).fetch, consent: yes }),
    ).rejects.toThrow(/\[ERR_MODEL_HTTP\].*status 404 from https:\/\/host\.test\/fake\.gguf/s);
  });
});

describe('sha256Of', () => {
  it('hashes a file the way the host publishes it', async () => {
    const file = path.join(dir, 'x.bin');
    fs.writeFileSync(file, CONTENT);
    expect(await sha256Of(file)).toBe(model.sha256);
  });
});
