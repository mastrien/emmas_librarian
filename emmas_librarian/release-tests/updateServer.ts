import fs from 'fs';
import http from 'http';
import path from 'path';

export interface UpdateServer {
  /** Every path asked for, decoded, in order: shows that the app really fetched latest.yml and the setup. */
  requests: string[];
  close(): Promise<void>;
}

/**
 * Serves an electron-builder output folder (latest.yml + setup .exe) as a "generic" update provider on
 * 127.0.0.1:`port`, the URL the release test builds bake into app-update.yml.
 * Blockmaps answer 404 so electron-updater downloads the whole installer instead of a differential one,
 * which would need Range support this server does not have.
 *
 * Usage:
 *   const server = await serveUpdates('release-update/9.0.1', 8765);
 *   // ... the installed 9.0.0 finds and downloads 9.0.1 ...
 *   await server.close();
 */
export async function serveUpdates(folder: string, port: number): Promise<UpdateServer> {
  const requests: string[] = [];
  const root = path.resolve(folder);
  const server = http.createServer((req, res) => answer(req, res, root, requests));
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  // Responses say "Connection: close", so no client keeps a socket to a server that went away; any socket
  // still open would also keep close() waiting.
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  return { requests, close };
}

function answer(req: http.IncomingMessage, res: http.ServerResponse, root: string, requests: string[]): void {
  const name = requestedName(req.url);
  if (name === null) return reply(res, 400);
  requests.push(name);
  const file = path.resolve(root, name);
  const servable = file.startsWith(root + path.sep) && !name.endsWith('.blockmap');
  if (!servable) return reply(res, 404);
  serveFile(file, res);
}

// A malformed escape ("%E0%A4%A") makes decodeURIComponent throw; uncaught in the handler, it would become an
// uncaughtException that leaves the client waiting and takes down the Playwright worker.
function requestedName(url: string | undefined): string | null {
  try {
    return decodeURIComponent(new URL(url ?? '/', 'http://localhost').pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
}

function serveFile(file: string, res: http.ServerResponse): void {
  let size: number;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return reply(res, 404);
    size = stat.size;
  } catch {
    return reply(res, 404);
  }
  const stream = fs.createReadStream(file);
  // The file can go away or get locked between the stat and the read.
  stream.on('error', () => (res.headersSent ? res.destroy() : reply(res, 500)));
  stream.once('open', () => {
    res.writeHead(200, { 'Content-Length': size, Connection: 'close' });
    stream.pipe(res);
  });
}

function reply(res: http.ServerResponse, status: number): void {
  res.writeHead(status, { Connection: 'close' }).end();
}
