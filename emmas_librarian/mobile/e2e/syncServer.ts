// A real desktop sync stack for the phone client's browser tests: the library on SQLite (with its migrations), the
// encrypted sync routes and the plain-HTTP listener code the app uses, the mobile build served beside them, and a few
// `/__test/` calls that stand in for the person at the computer (seed data, review what the phone changed).
// Run with: npx vite-node mobile/e2e/syncServer.ts
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { gatewayListener } from '../../adapters/electron/remote/gatewayListener';
import { PhoneSyncAccess } from '../../adapters/electron/remote/PhoneSyncAccess';
import { staticSiteIn } from '../../adapters/electron/remote/staticSite';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { DatabaseAdapter } from '../../core/database/DatabaseAdapter';
import { PlainTextSecretStore } from '../../core/ports/SecretStore';
import { RemoteGateway } from '../../core/remote/RemoteGateway';

const PORT = Number(process.env.PORT ?? 4180);
const FIXTURE_PDF = path.join(__dirname, '../../e2e-tests/fixtures/artigo-teste-emma.pdf');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-mobile-e2e-'));
const pdfCopy = path.join(userData, 'artigo-teste-emma.pdf');
fs.copyFileSync(FIXTURE_PDF, pdfCopy);

/** One desktop: a library, the phone-sync side of it, and the gateway in front. `reset` makes a new one. */
function newDesktop() {
  const db = new DatabaseAdapter(':memory:');
  const phoneSync = new PhoneSyncAccess({
    userData: fs.mkdtempSync(path.join(userData, 'device-')),
    secrets: new PlainTextSecretStore(),
    syncParts: () => db.librarySync.parts(),
  });
  const gateway = new RemoteGateway({
    commands: new CommandRegistry(),
    authenticate: () => null,
    sync: phoneSync.routes(),
    hideInternalErrors: true,
  });
  return {
    db,
    phoneSync,
    listener: gatewayListener(gateway, { site: staticSiteIn(path.join(__dirname, '../../dist-mobile')) }),
  };
}

let desktop = newDesktop();

function read(req: http.IncomingMessage): Promise<{ [key: string]: unknown }> {
  return new Promise((resolve) => {
    let text = '';
    req.on('data', (chunk) => (text += chunk));
    req.on('end', () => resolve(text ? (JSON.parse(text) as { [key: string]: unknown }) : {}));
  });
}

type Handler = (body: { [key: string]: unknown }) => Promise<unknown> | unknown;

const controls: { [route: string]: Handler } = {
  // Every test starts on a computer that has never met a phone and has no projects.
  'POST /__test/reset': () => {
    desktop = newDesktop();
  },
  // A project with one article that has the fixture PDF, and a diary page written on the computer.
  'POST /__test/seed': () => {
    const project = desktop.db.createProject('Revisão sistemática');
    const article = desktop.db.saveArticle(project.id, {
      title: 'Revisões sistemáticas assistidas por ferramentas digitais',
      source_query: '',
      source_databases: '',
      csl_json: '{}',
    });
    desktop.db.updateArticleFilePath(article, pdfCopy);
    desktop.db.saveDiaryEntry(project.id, '2026-11-20', 'Escrito no computador.', null);
    return { projectId: project.id, articleId: article };
  },
  'GET /__test/offer': async () => (await desktop.phoneSync.offerUrl('localhost', PORT, PORT)).url,
  'GET /__test/pending': () => desktop.phoneSync.listPending(),
  'POST /__test/apply': () => desktop.phoneSync.apply(desktop.phoneSync.listPending().map((change) => change.opId)),
  'POST /__test/reject': () => desktop.phoneSync.reject(desktop.phoneSync.listPending().map((change) => change.opId)),
  'GET /__test/state': () => ({
    diary: desktop.db.getAllProjects().flatMap((project) => desktop.db.getDiaryEntries(project.id)),
    highlights: desktop.db
      .getAllProjects()
      .flatMap((project) =>
        desktop.db.getArticlesByProject(project.id).flatMap((article) => desktop.db.getHighlights(article.id)),
      ),
  }),
};

const server = http.createServer(async (req, res) => {
  const handler = controls[`${req.method} ${req.url?.split('?')[0]}`];
  if (!handler) return desktop.listener(req, res);
  try {
    const result = await handler(await read(req));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result ?? null));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(error) }));
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`phone sync test server on http://localhost:${PORT}`));
