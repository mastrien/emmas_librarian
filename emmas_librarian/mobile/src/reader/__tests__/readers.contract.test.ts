// The two readers against the real desktop: a project seeded in real SQLite, exported by the real
// ProjectSyncService (the file reader) and served by the real commands under the paired-device policy
// (the HTTP reader). Both must answer the screens the same.
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IpcChannel } from '../../../../src/types';
import { DatabaseAdapter } from '../../../../core/database/DatabaseAdapter';
import { ProjectSyncService } from '../../../../core/database/ProjectSyncService';
import { seedFullProject } from '../../../../core/database/__tests__/support/fullProjectFixture';
import { buildLibraryCommands } from '../../../../core/commands/libraryCommands';
import type { CommandRegistry } from '../../../../core/commands/CommandRegistry';
import { appPathsIn } from '../../../../core/ports/AppPaths';
import { FakeAppRuntime } from '../../../../core/ports/__tests__/fakes/FakeAppRuntime';
import { authorizeRemoteCommand } from '../../../../core/remote/remoteAccessPolicy';
import { ArchiveProjectReader } from '../ArchiveProjectReader';
import { DesktopError, HttpProjectReader, type DesktopTransport } from '../HttpProjectReader';
import type { ProjectReader } from '../ProjectReader';

/** The desktop without the network: runs what a paired device may run, and refuses the rest as the server does. */
class PairedDeviceTransport implements DesktopTransport {
  readonly ran: string[] = [];

  constructor(private readonly commands: CommandRegistry) {}

  async run(channel: string, given: unknown[] = []): Promise<unknown> {
    this.ran.push(channel);
    const { command, args } = authorizeRemoteCommand(this.commands, { kind: 'device', deviceId: 'd1' }, channel, given);
    try {
      // Through JSON, like the wire: what does not survive it would not reach the phone either.
      return JSON.parse(JSON.stringify((await command.run(...(args as never[]))) ?? null));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DesktopError(/^\[(ERR_[A-Z_]+)\]/.exec(message)?.[1] ?? 'ERR_INTERNAL', message, 400);
    }
  }

  async runForBytes(channel: string, given: unknown[] = []): Promise<Uint8Array> {
    this.ran.push(channel);
    const { command, args } = authorizeRemoteCommand(this.commands, { kind: 'device', deviceId: 'd1' }, channel, given);
    try {
      return new Uint8Array((await command.run(...(args as never[]))) as Buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DesktopError(/^\[(ERR_[A-Z_]+)\]/.exec(message)?.[1] ?? 'ERR_INTERNAL', message, 400);
    }
  }
}

let workDir: string;
let db: DatabaseAdapter;
let projectId: number;
let desktop: PairedDeviceTransport;
let overHttp: HttpProjectReader;
let fromFile: ArchiveProjectReader;

beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-mobile-readers-'));
  const paths = appPathsIn(path.join(workDir, 'userData'));
  fs.mkdirSync(paths.pdfsDir, { recursive: true });
  const pdfPath = path.join(paths.pdfsDir, 'a.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.4 conteúdo');
  const docPath = path.join(workDir, 'edital.pdf');
  fs.writeFileSync(docPath, 'DOC');
  db = new DatabaseAdapter(paths.dbPath);
  projectId = seedFullProject(db.getDB(), { pdfPath, docPath });
  const target = path.join(workDir, 'tese.emmapcarc');
  await new ProjectSyncService(db, paths).exportProject(projectId, target);
  fromFile = new ArchiveProjectReader(new Uint8Array(fs.readFileSync(target)));
  desktop = new PairedDeviceTransport(
    buildLibraryCommands(db, { paths, runtime: new FakeAppRuntime(), env: {} }).commands,
  );
  overHttp = new HttpProjectReader(desktop);
});

afterAll(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

const readers = (): [string, ProjectReader][] => [
  ['over HTTP', overHttp],
  ['from the file', fromFile],
];
const titles = (rows: { title: string }[]) => rows.map((row) => row.title).sort();

describe.each(['over HTTP', 'from the file'])('ProjectReader %s', (label) => {
  const reader = () => readers().find(([name]) => name === label)![1];
  const articleWithPdf = async () => (await reader().listArticles(projectId)).find((article) => article.title === 'A')!;

  it('lists the project', async () => {
    expect((await reader().listProjects()).map((project) => project.name)).toEqual(['Tese']);
  });

  it('lists the articles of the project with their metadata, and finds one by id', async () => {
    const articles = await reader().listArticles(projectId);
    const article = await articleWithPdf();

    expect(titles(articles)).toEqual(['A', 'B']);
    expect(article).toMatchObject({ project_id: projectId, status: expect.any(String) });
    expect((await reader().getArticle(article.id))?.title).toBe('A');
    expect(await reader().getArticle(99999)).toBeNull();
  });

  it('reads the PDF of an article that has one, and null for one that has none', async () => {
    const articles = await reader().listArticles(projectId);
    const pdf = await reader().readPdf((await articleWithPdf()).id);

    expect(new TextDecoder().decode(pdf!)).toBe('%PDF-1.4 conteúdo');
    expect(await reader().readPdf(articles.find((article) => article.title === 'B')!.id)).toBeNull();
  });

  it('lists the highlights of an article with the note linked to each, and its annotations', async () => {
    const { id } = await articleWithPdf();
    const highlights = await reader().listHighlights(id);
    const annotations = await reader().listAnnotations(id);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].comment).toBe(annotations[0].content_markdown);
    expect(highlights[0]).toMatchObject({ article_id: id, color: expect.any(String) });
  });

  it('lists the diary, the quick access documents and the categories with their options', async () => {
    const [diary, documents, categories] = await Promise.all([
      reader().listDiary(projectId),
      reader().listDocuments(projectId),
      reader().listCategories(projectId),
    ]);

    expect(diary[0]).toMatchObject({
      project_id: projectId,
      entry_date: expect.any(String),
      content: expect.any(String),
    });
    expect(documents).toMatchObject([{ title: 'Edital', url: 'https://example.org/edital' }]);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.find((category) => category.type === 'enum')?.parsedOptions?.length).toBeGreaterThan(0);
  });
});

describe('the two readers', () => {
  it('answer the same articles, highlights, diary, documents and categories for the same project', async () => {
    const snapshot = async (reader: ProjectReader) => {
      const articles = await reader.listArticles(projectId);
      const { id } = articles.find((article) => article.title === 'A')!;
      return {
        articles: titles(articles),
        highlights: (await reader.listHighlights(id)).map(({ content_text, color, comment }) => ({
          content_text,
          color,
          comment,
        })),
        annotations: (await reader.listAnnotations(id)).map((note) => note.content_markdown),
        diary: (await reader.listDiary(projectId)).map(({ entry_date, content }) => ({ entry_date, content })),
        documents: (await reader.listDocuments(projectId)).map(({ title, url, category }) => ({
          title,
          url,
          category,
        })),
        categories: (await reader.listCategories(projectId)).map(({ name, type, parsedOptions }) => ({
          name,
          type,
          options: (parsedOptions ?? []).map((option) => option.name),
        })),
        articleCategories: (await reader.listArticleCategories(id))
          .map(({ name, type, value, option_names }) => ({
            name,
            type,
            value: value ?? null,
            options: option_names ?? [],
          }))
          .sort((a, b) => `${a.name}|${a.value}`.localeCompare(`${b.name}|${b.value}`)),
      };
    };

    expect(await snapshot(fromFile)).toEqual(await snapshot(overHttp));
  });

  it('differ in what they allow: the desktop takes the four writes, a file takes none', () => {
    expect(fromFile).toMatchObject({ source: 'file', writer: null });
    expect(overHttp.source).toBe('desktop');
    expect(Object.keys(overHttp.writer).sort()).toEqual(
      ['addQuickLink', 'markDocumentOpened', 'saveDiaryEntry', 'setArticleCategory'].sort(),
    );
  });
});

describe('HttpProjectReader writes, on the real library', () => {
  it('saves a diary page', async () => {
    await overHttp.writer.saveDiaryEntry(projectId, '2026-11-14', 'Do celular.');

    expect(db.getDiaryEntry(projectId, '2026-11-14')?.content).toBe('Do celular.');
  });

  it('adds a quick access link and marks it opened', async () => {
    await overHttp.writer.addQuickLink(projectId, 'Periódico', 'https://example.org/revista');
    const added = (await overHttp.listDocuments(projectId)).find((document) => document.title === 'Periódico')!;
    await overHttp.writer.markDocumentOpened(added.id);

    const stored = db.getProjectDocuments(projectId).find((document) => document.id === added.id)!;
    expect(stored).toMatchObject({ url: 'https://example.org/revista', local_file_path: null });
    expect(stored.last_opened_at).toBeTruthy();
  });

  it('sets a text category of an article', async () => {
    const categoryId = db.createProjectCategory(projectId, 'Observação', 'text');
    const [{ id }] = await overHttp.listArticles(projectId);

    await overHttp.writer.setArticleCategory(id, categoryId, 'reler');

    expect((await overHttp.listArticleCategories(id)).find((c) => c.category_id === categoryId)?.value).toBe('reler');
  });

  it('only ever asks the desktop for commands a paired device may run', () => {
    expect(desktop.ran.length).toBeGreaterThan(10);
    expect(desktop.ran).not.toContain(IpcChannel.SETTINGS_GET);
  });
});

describe('ArchiveProjectReader with files it cannot read', () => {
  it('refuses a zip without project.json', async () => {
    const { zipSync, strToU8 } = await import('fflate');

    expect(() => new ArchiveProjectReader(zipSync({ 'outro.txt': strToU8('x') }))).toThrow('não contém project.json');
  });

  it('refuses a file written in a newer format, saying to update', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const newer = zipSync({
      'project.json': strToU8(JSON.stringify({ formatVersion: 99, project: {}, articles: [] })),
    });

    expect(() => new ArchiveProjectReader(newer)).toThrow('formato 99');
  });

  it('reads a file from before the optional lists existed', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const old = {
      project: { id: 1, name: 'Velho' },
      articles: [{ id: 5, project_id: 1, title: 'A', deleted_at: null }],
    };
    const reader = new ArchiveProjectReader(zipSync({ 'project.json': strToU8(JSON.stringify(old)) }));

    expect(titles(await reader.listArticles(1))).toEqual(['A']);
    expect(await reader.listHighlights(5)).toEqual([]);
    expect(await reader.listCategories(1)).toEqual([]);
    expect(await reader.listArticleCategories(5)).toEqual([]);
    expect(await reader.readPdf(5)).toBeNull();
    expect(await reader.listArticles(2)).toEqual([]);
  });
});
