import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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

/** What the host answers when asked for the bytes from `from` on (0 asks for the whole file). */
function request(model: AgentModelFile, deps: DownloadDeps, from: number): Promise<Response> {
  return deps.fetch(model.url, { headers: from > 0 ? { range: `bytes=${from}-` } : {} });
}

function assertBody(model: AgentModelFile, response: Response): Response {
  if (response.ok && response.body) return response;
  throw fail(
    'ERR_MODEL_HTTP',
    `Offending value: status ${response.status} from ${model.url}`,
    '200 or 206 with a body',
  );
}

/** 416 means the old bytes are not a prefix this host can continue (a finished or foreign .part): start over. */
async function openResponse(model: AgentModelFile, deps: DownloadDeps, partial: string): Promise<[Response, boolean]> {
  const from = partialSize(partial, model);
  const response = await request(model, deps, from);
  if (response.status !== 416) return [assertBody(model, response), from > 0];
  fs.rmSync(partial, { force: true });
  return [assertBody(model, await request(model, deps, 0)), false];
}

/** The bytes as they arrive, counted for the progress report. */
async function* counted(source: AsyncIterable<Uint8Array>, start: number, model: AgentModelFile, deps: DownloadDeps) {
  let done = start;
  for await (const chunk of source) {
    done += chunk.length;
    deps.onProgress?.(done, model.sizeBytes);
    yield chunk;
  }
}

async function writeBody(
  response: Response,
  partial: string,
  resumed: boolean,
  model: AgentModelFile,
  deps: DownloadDeps,
): Promise<void> {
  // A host that answers 200 to a range request sent the whole file: start over instead of appending to the old bytes.
  const append = resumed && response.status === 206;
  const start = append ? fs.statSync(partial).size : 0;
  const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  // pipeline listens to the 'error' of the file (ENOSPC, EISDIR, EPERM) and closes it, which a bare write stream does not.
  await pipeline(
    body,
    (source) => counted(source, start, model, deps),
    fs.createWriteStream(partial, { flags: append ? 'a' : 'w' }),
  ).catch((error: Error) => {
    throw fail(
      'ERR_MODEL_STREAM',
      `Offending value: ${error.message} while writing ${partial}`,
      'a writable file and a body that ends',
    );
  });
}

/** A .part that already has every byte (the app died before the rename) must not be asked for a range past its end. */
async function adoptCompletePartial(model: AgentModelFile, partial: string, target: string): Promise<boolean> {
  if (!fs.existsSync(partial) || fs.statSync(partial).size !== model.sizeBytes) return false;
  try {
    await verified(model, partial);
  } catch {
    fs.rmSync(partial, { force: true });
    return false;
  }
  fs.renameSync(partial, target);
  return true;
}

async function downloadAndKeep(
  model: AgentModelFile,
  deps: DownloadDeps,
  partial: string,
  target: string,
): Promise<void> {
  const [response, resumed] = await openResponse(model, deps, partial);
  await writeBody(response, partial, resumed, model, deps);
  try {
    await verified(model, partial);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
  fs.renameSync(partial, target);
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
  if (!(await adoptCompletePartial(model, partial, target))) await downloadAndKeep(model, deps, partial, target);
  return target;
}
