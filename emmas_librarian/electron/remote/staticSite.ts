import fs from 'fs';
import path from 'path';
import type { GatewayResponse } from '../../core/remote/RemoteGateway';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/** Answers a GET for a path with a file of the site, or null when the site has no such file. */
export type StaticSite = (pathname: string) => GatewayResponse | null;

/**
 * Serves the files of one folder (the built mobile client) and nothing outside it: a path that climbs
 * out with "..", an unknown file type and a missing file are all "not here".
 *
 * Usage:
 *   const site = staticSiteIn('/opt/app/dist-mobile');
 *   site('/assets/index.js'); // { status: 200, contentType: 'text/javascript; charset=utf-8', body }
 */
export function staticSiteIn(rootDir: string): StaticSite {
  const root = path.resolve(rootDir);
  return (pathname) => {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
    if (!contentType || !file.startsWith(root + path.sep) || !fs.existsSync(file)) return null;
    if (!fs.statSync(file).isFile()) return null;
    return { status: 200, contentType, body: fs.readFileSync(file) };
  };
}

/**
 * The first of the folders that holds a built site (an index.html), or null.
 *
 * Usage:
 *   const dir = firstSiteDir([path.join(app.getAppPath(), 'dist-mobile'), path.join(process.cwd(), 'dist-mobile')]);
 */
export function firstSiteDir(candidates: string[]): string | null {
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ?? null;
}
