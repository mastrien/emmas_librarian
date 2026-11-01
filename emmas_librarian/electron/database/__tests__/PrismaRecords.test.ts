// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { registerPrismaHandlers, tablePathFor } from '../../ipc/handlers/prismaHandlers';
import { registerArticleHandlers } from '../../ipc/handlers/articleHandlers';
import { IpcChannel, type PrismaRecords } from '../../types';

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() } }));

class RecordingRegistrar {
  public handlers = new Map<string, (...args: unknown[]) => unknown>();
  handle(channel: string, listener: (...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }
}

let db: DatabaseAdapter;
let projectId: number;
const article = (title: string, project = projectId) => db.saveArticle(project, { title, authors: '' } as never);

beforeEach(() => {
  db = new DatabaseAdapter(':memory:');
  projectId = db.createProject('Revisão').id;
});

afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
});

describe('PRISMA sources and origins (#50), against real SQLite', () => {
  it('creates and updates a source, trimming the text', () => {
    const created = db.prismaOriginRepo.saveSource(projectId, { name: ' Google Scholar ', method: 'websites' });
    db.prismaOriginRepo.saveSource(projectId, {
      id: created.id,
      name: 'Scholar',
      method: 'websites',
      consulted_on: '2026-10-20',
    });

    expect(db.prismaOriginRepo.listSources(projectId)).toEqual([
      {
        id: created.id,
        project_id: projectId,
        name: 'Scholar',
        method: 'websites',
        url: null,
        consulted_on: '2026-10-20',
      },
    ]);
  });

  it.each([
    [{ name: '', method: 'websites' }, 'name=""'],
    [{ name: 'X', method: 'blog' }, 'method="blog"'],
    [{ name: 'X', method: 'websites', consulted_on: '20/10/2026' }, 'consulted_on="20/10/2026"'],
  ])('refuses %o, naming the offending value', (input, offending) => {
    expect(() => db.prismaOriginRepo.saveSource(projectId, input as never)).toThrowError(offending);
    expect(db.prismaOriginRepo.listSources(projectId)).toEqual([]);
  });

  it('tells and forgets where articles came from, replacing an earlier origin', () => {
    const a = article('A');
    const b = article('B');
    const scholar = db.prismaOriginRepo.saveSource(projectId, { name: 'Scholar', method: 'websites' });
    const refs = db.prismaOriginRepo.saveSource(projectId, { name: 'Referências', method: 'citations' });

    db.prismaOriginRepo.setOrigins(projectId, [a, b], scholar.id);
    db.prismaOriginRepo.setOrigins(projectId, [b], refs.id);
    expect(db.prismaOriginRepo.listOrigins(projectId)).toEqual([
      { article_id: a, source_id: scholar.id },
      { article_id: b, source_id: refs.id },
    ]);

    db.prismaOriginRepo.setOrigins(projectId, [a], null);
    expect(db.prismaOriginRepo.listOrigins(projectId)).toEqual([{ article_id: b, source_id: refs.id }]);
  });

  it("refuses another project's source or article, and changes nothing", () => {
    const other = db.createProject('Outro').id;
    const foreignSource = db.prismaOriginRepo.saveSource(other, { name: 'Lá', method: 'other' });
    const mine = article('A');
    const source = db.prismaOriginRepo.saveSource(projectId, { name: 'Aqui', method: 'other' });

    expect(() => db.prismaOriginRepo.setOrigins(projectId, [mine], foreignSource.id)).toThrowError('source_id=');
    expect(() => db.prismaOriginRepo.setOrigins(projectId, [mine, article('B', other)], source.id)).toThrowError(
      'article_id=',
    );
    expect(db.prismaOriginRepo.listOrigins(projectId)).toEqual([]);
  });

  it('forgets the origins of a deleted source', () => {
    const a = article('A');
    const source = db.prismaOriginRepo.saveSource(projectId, { name: 'Scholar', method: 'websites' });
    db.prismaOriginRepo.setOrigins(projectId, [a], source.id);

    db.getDB().prepare('DELETE FROM prisma_sources WHERE id = ?').run(source.id);

    expect(db.prismaOriginRepo.listOrigins(projectId)).toEqual([]);
  });
});

describe('Publications of the same study (#50), against real SQLite', () => {
  it('links two publications to the first one, and joins two studies into one', () => {
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((t) => article(t));
    db.prismaStudyRepo.link(projectId, a, b);
    db.prismaStudyRepo.link(projectId, c, d);

    db.prismaStudyRepo.link(projectId, b, d);

    expect(db.prismaStudyRepo.listLinks(projectId)).toEqual([
      { article_id: b, study_article_id: a },
      { article_id: c, study_article_id: a },
      { article_id: d, study_article_id: a },
    ]);
  });

  it('does nothing when both are already of the same study', () => {
    const [a, b] = ['A', 'B'].map((t) => article(t));
    db.prismaStudyRepo.link(projectId, a, b);
    db.prismaStudyRepo.link(projectId, b, a);

    expect(db.prismaStudyRepo.listLinks(projectId)).toEqual([{ article_id: b, study_article_id: a }]);
  });

  it('undoes a study, and refuses an article of another project', () => {
    const [a, b] = ['A', 'B'].map((t) => article(t));
    db.prismaStudyRepo.link(projectId, a, b);
    const foreign = article('X', db.createProject('Outro').id);

    expect(() => db.prismaStudyRepo.link(projectId, a, foreign)).toThrowError(String(foreign));
    db.prismaStudyRepo.unlink(projectId, a);

    expect(db.prismaStudyRepo.listLinks(projectId)).toEqual([]);
  });
});

describe('PRISMA IPC channels (#50)', () => {
  let dir: string;
  let call: (channel: string, ...args: unknown[]) => unknown;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-prisma-'));
    const ipc = new RecordingRegistrar();
    registerPrismaHandlers(ipc as never, db);
    registerArticleHandlers(ipc as never, db);
    call = (channel, ...args) => ipc.handlers.get(channel)!({}, ...args);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('answers every change with the records as they now are', async () => {
    const a = article('A');
    const withSource = (await call(IpcChannel.PRISMA_SOURCE_SAVE, projectId, {
      name: 'Scholar',
      method: 'websites',
    })) as PrismaRecords;

    const tagged = (await call(
      IpcChannel.PRISMA_ORIGINS_SET,
      projectId,
      [a],
      withSource.sources[0].id,
    )) as PrismaRecords;

    expect(tagged.origins).toEqual([{ article_id: a, source_id: withSource.sources[0].id }]);
    expect(await call(IpcChannel.PRISMA_RECORDS_GET, projectId)).toEqual(tagged);
  });

  it('tags articles copied from another project with that project as their source', async () => {
    const source = db.createProject('Chuvas extremas').id;
    const copied = article('Radar', source);

    await call(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, source, projectId, [copied]);
    await call(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, source, projectId, [copied]);

    const records = (await call(IpcChannel.PRISMA_RECORDS_GET, projectId)) as PrismaRecords;
    expect(records.sources).toMatchObject([{ name: 'Projeto "Chuvas extremas"', method: 'app_projects' }]);
    expect(records.origins).toHaveLength(2);
    expect(new Set(records.origins.map((o) => o.source_id))).toEqual(new Set([records.sources[0].id]));
  });

  it('saves the SVG and both tables beside it, each with a byte order mark for Excel', async () => {
    const target = path.join(dir, 'diagrama.svg');
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', target);

    const saved = await call(IpcChannel.EXPORT_PRISMA, projectId, 'svg', '<svg>n = 11</svg>', {
      data: 'Caixa;n\nIncluídos;11',
      excluded: 'Referência;Motivo',
    });

    expect(saved).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('<svg>n = 11</svg>');
    expect(fs.readFileSync(path.join(dir, 'diagrama_dados.csv'), 'utf8')).toBe('﻿Caixa;n\nIncluídos;11');
    expect(fs.readFileSync(path.join(dir, 'diagrama_excluidas.csv'), 'utf8')).toBe('﻿Referência;Motivo');
  });

  it('writes a PNG from the base64 the renderer sends', async () => {
    const target = path.join(dir, 'diagrama.png');
    vi.stubEnv('E2E_MOCK_SAVE_FILE_PATH', target);

    await call(IpcChannel.EXPORT_PRISMA, projectId, 'png', Buffer.from('PNGDATA').toString('base64'), {
      data: 'x',
      excluded: 'y',
    });

    expect(fs.readFileSync(target, 'utf8')).toBe('PNGDATA');
  });

  it('refuses another image format, and an unknown project', async () => {
    const tables = { data: '', excluded: '' };
    await expect(call(IpcChannel.EXPORT_PRISMA, projectId, 'pdf', '', tables)).rejects.toThrow();
    await expect(call(IpcChannel.EXPORT_PRISMA, 999, 'svg', '', tables)).rejects.toThrow();
  });

  it('names each table after the image', () => {
    expect(tablePathFor(path.join('out', 'prisma.png'), 'excluidas')).toBe(path.join('out', 'prisma_excluidas.csv'));
  });
});
