/**
 * VectorStore against real SQLite and sqlite-vec. A mocked database hid that the indexed query picks its nearest
 * neighbours across the whole library before looking at the article.
 */
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { VectorStore } from '../VectorStore';
import type { PdfTextChunk } from '../PdfExtractor';

vi.mock('electron', () => ({ safeStorage: {} }));

const chunkAt = (text: string, page = 1): PdfTextChunk => ({ text, page, bbox: { x: 1, y: 2, w: 3, h: 4 } });

describe('VectorStore', () => {
  let db: Database.Database;
  let store: VectorStore;
  let first: number;
  let second: number;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:').getDB();
    store = new VectorStore(db);
    const project = Number(db.prepare("INSERT INTO projects (name) VALUES ('P')").run().lastInsertRowid);
    const article = db.prepare("INSERT INTO articles (project_id, title) VALUES (?, 'A')");
    first = Number(article.run(project).lastInsertRowid);
    second = Number(article.run(project).lastInsertRowid);
  });

  // `count` chunks of an article, each `step` further from the origin, where the queries look.
  function indexRow(articleId: number, name: string, count: number, from: number, step = 0.001): void {
    const chunks = Array.from({ length: count }, (_, i) => chunkAt(`${name}${i}`));
    store.indexArticleChunks(
      articleId,
      chunks,
      chunks.map((_, i) => [from + i * step, 0]),
    );
  }

  const rows = (table: string) => (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

  it('indexes chunks with their vectors', () => {
    indexRow(first, 'a', 2, 0);

    expect(rows('pdf_chunks')).toBe(2);
    expect(rows('pdf_chunk_embeddings')).toBe(2);
  });

  it('refuses chunks and vectors of different lengths', () => {
    expect(() => store.indexArticleChunks(first, [chunkAt('a')], [])).toThrow('same length');
  });

  it('does nothing without chunks', () => {
    store.indexArticleChunks(first, [], []);

    expect(rows('pdf_chunks')).toBe(0);
  });

  it('finds the nearest chunks of the article, nearest first, with page and box', () => {
    store.indexArticleChunks(
      first,
      [chunkAt('longe', 2), chunkAt('perto', 7)],
      [
        [0.9, 0],
        [0.1, 0],
      ],
    );

    const found = store.searchSimilar([0, 0], 2, first);

    expect(found.map((c) => c.text)).toEqual(['perto', 'longe']);
    expect(found[0]).toMatchObject({ page: 7, bbox: { x: 1, y: 2, w: 3, h: 4 } });
    expect(found[0].similarityScore).toBeLessThan(found[1].similarityScore);
  });

  // Without a filter ahead of the search, the 10 nearest of the library were all from the other article, and this
  // article got none (or only the ones that happened to be among them).
  it('returns as many chunks of the article as asked, even when other articles are nearer', () => {
    indexRow(first, 'a', 50, 0);
    indexRow(second, 'b', 12, 100);

    expect(store.searchSimilar([0, 0], 10, second).map((c) => c.text)).toEqual(
      Array.from({ length: 10 }, (_, i) => `b${i}`),
    );
  });

  it('does not stop at the one chunk that is among the nearest of the library', () => {
    indexRow(first, 'a', 50, 0);
    indexRow(second, 'b', 11, 0.0105, 10);

    expect(store.searchSimilar([0, 0], 15, second)).toHaveLength(11);
  });

  it('answers through the plain distance when the indexed query fails', () => {
    indexRow(first, 'a', 12, 0);
    const realPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
      if (sql.includes('MATCH')) throw new Error('unsupported');
      return realPrepare(sql);
    }) as typeof db.prepare);

    expect(store.searchSimilar([0, 0], 3, first).map((c) => c.text)).toEqual(['a0', 'a1', 'a2']);
  });

  it('removes the chunks of an article and leaves the others', () => {
    indexRow(first, 'a', 2, 0);
    indexRow(second, 'b', 1, 0);

    store.removeArticleChunks(first);

    expect(rows('pdf_chunks')).toBe(1);
    expect(rows('pdf_chunk_embeddings')).toBe(1);
  });

  it('creates the vector table at the size asked', () => {
    expect(store.ensureDimensionAndClearIfMismatched(128)).toBe(false);

    expect(store.ensureDimensionAndClearIfMismatched(128)).toBe(false);
  });

  it('clears the index when the size changes', () => {
    indexRow(first, 'a', 2, 0);

    expect(store.ensureDimensionAndClearIfMismatched(3)).toBe(true);

    expect(rows('pdf_chunks')).toBe(0);
    expect(rows('pdf_chunk_embeddings')).toBe(0);
  });
});
