import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentModelFile } from './agentModels';

/** Just what the download needs from `fetch`, so a test can serve the file without a network. */
export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export interface DownloadDeps {
  /** The folder the models live in. */
  dir: string;
  fetch: FetchLike;
  /** Asked once, before any byte is downloaded, with the file, its size and its license; false cancels. */
  consent: (model: AgentModelFile) => Promise<boolean>;
  onProgress?: (done: number, total: number) => void;
}

const fail = (code: string, problem: string, expected: string): Error =>
  new Error(`[${code}] ${problem}. Expected ${expected}.`);

/** The SHA-256 of a file, read in pieces so a 1 GB model never sits in memory. */
export async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function verified(model: AgentModelFile, file: string): Promise<void> {
  const actual = await sha256Of(file);
  if (actual === model.sha256) return;
  throw fail('ERR_MODEL_HASH', `Offending value: sha256 ${actual} of ${file}`, `sha256 ${model.sha256}`);
}

function partialSize(partial: string, model: AgentModelFile): number {
  if (!fs.existsSync(partial)) return 0;
  const size = fs.statSync(partial).size;
  if (size <= model.sizeBytes) return size;
  fs.rmSync(partial);
  return 0;
}

async function openResponse(model: AgentModelFile, deps: DownloadDeps, from: number): Promise<Response> {
  const response = await deps.fetch(model.url, { headers: from > 0 ? { range: `bytes=${from}-` } : {} });
  if (response.ok && response.body) return response;
  throw fail(
    'ERR_MODEL_HTTP',
    `Offending value: status ${response.status} from ${model.url}`,
    '200 or 206 with a body',
  );
}

async function writeBody(
  response: Response,
  partial: string,
  resumed: boolean,
  model: AgentModelFile,
  deps: DownloadDeps,
) {
  // A host that answers 200 to a range request sent the whole file: start over instead of appending to the old bytes.
  const append = resumed && response.status === 206;
  const out = fs.createWriteStream(partial, { flags: append ? 'a' : 'w' });
  let done = append ? fs.statSync(partial).size : 0;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
    done += chunk.length;
    deps.onProgress?.(done, model.sizeBytes);
  }
  await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
}

/**
 * Makes sure the model file is in the folder, downloading it only if the person agrees. A file already there must
 * match the published SHA-256 (it is never overwritten); a download that was cut resumes from the bytes it has.
 *
 * Usage:
 *   const file = await ensureModelFile(agentModel('chat'), { dir, fetch, consent: askOnTerminal });
 */
export async function ensureModelFile(model: AgentModelFile, deps: DownloadDeps): Promise<string> {
  const target = path.join(deps.dir, model.file);
  if (fs.existsSync(target)) {
    await verified(model, target);
    return target;
  }
  if (!(await deps.consent(model)))
    throw fail(
      'ERR_DOWNLOAD_DECLINED',
      `Offending value: the download of ${model.file} was declined`,
      'a yes before downloading',
    );
  fs.mkdirSync(deps.dir, { recursive: true });
  const partial = `${target}.part`;
  const from = partialSize(partial, model);
  await writeBody(await openResponse(model, deps, from), partial, from > 0, model, deps);
  try {
    await verified(model, partial);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
  fs.renameSync(partial, target);
  return target;
}
