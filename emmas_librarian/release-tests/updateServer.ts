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
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname).replace(/^\/+/, '');
    requests.push(name);
    const file = path.resolve(root, name);
    const servable = file.startsWith(root + path.sep) && !name.endsWith('.blockmap') && fs.existsSync(file);
    if (!servable || !fs.statSync(file).isFile()) {
      res.writeHead(404, { Connection: 'close' }).end();
      return;
    }
    res.writeHead(200, { 'Content-Length': fs.statSync(file).size, Connection: 'close' });
    fs.createReadStream(file).pipe(res);
  });
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
