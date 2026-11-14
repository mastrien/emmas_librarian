/**
 * VectorStore against real SQLite and sqlite-vec. A mocked database hid that the indexed query picks its nearest
 * neighbours across the whole library before looking at the article.
 */
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { VectorStore } from '../VectorStore';
import type { PdfTextChunk } from '../PdfExtractor';

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

  describe('searchSimilarAcross', () => {
    it('finds the nearest among the articles asked, saying whose they are', () => {
      indexRow(first, 'a', 3, 0);
      indexRow(second, 'b', 3, 0.0005);

      const found = store.searchSimilarAcross([0, 0], 4, [first, second]);

      expect(found.map((c) => [c.articleId, c.text])).toEqual([
        [first, 'a0'],
        [second, 'b0'],
        [first, 'a1'],
        [second, 'b1'],
      ]);
    });

    it('leaves out an article not asked, however near it is', () => {
      indexRow(first, 'a', 50, 0);
      indexRow(second, 'b', 12, 100);

      const found = store.searchSimilarAcross([0, 0], 10, [second]);

      expect(found).toHaveLength(10);
      expect(new Set(found.map((c) => c.articleId))).toEqual(new Set([second]));
    });

    it('gives the same answer through the plain distance', () => {
      indexRow(first, 'a', 3, 0);
      indexRow(second, 'b', 3, 0.0005);
      const indexed = store.searchSimilarAcross([0, 0], 4, [first, second]).map((c) => c.text);
      const realPrepare = db.prepare.bind(db);
      vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
        if (sql.includes('MATCH')) throw new Error('unsupported');
        return realPrepare(sql);
      }) as typeof db.prepare);

      expect(store.searchSimilarAcross([0, 0], 4, [first, second]).map((c) => c.text)).toEqual(indexed);
    });

    it('takes more articles than SQLite takes bound parameters', () => {
      indexRow(first, 'a', 1, 0);
      const many = [first, ...Array.from({ length: 40_000 }, (_, i) => 100_000 + i)];

      expect(store.searchSimilarAcross([0, 0], 1, many)).toHaveLength(1);
    });

    it('finds nothing when no article is asked or nothing is indexed yet', () => {
      expect(store.searchSimilarAcross([0, 0], 5, [first])).toEqual([]);

      indexRow(first, 'a', 1, 0);
      expect(store.searchSimilarAcross([0, 0], 5, [])).toEqual([]);
    });
  });

  describe('indexedDimension', () => {
    it('is unknown before the first indexing, then the size of the vectors', () => {
      expect(store.indexedDimension()).toBeNull();

      indexRow(first, 'a', 1, 0);

      expect(store.indexedDimension()).toBe(2);
    });

    it('only reads', () => {
      indexRow(first, 'a', 2, 0);

      store.indexedDimension();

      expect(rows('pdf_chunks')).toBe(2);
    });
  });

  it('records which model indexed the chunks', () => {
    store.indexArticleChunks(first, [chunkAt('a')], [[0, 0]], 'openai/x');

    expect(db.prepare('SELECT embedding_model AS m FROM pdf_chunks').get()).toEqual({ m: 'openai/x' });
  });

  it('replaces what the article had, leaving the others', () => {
    store.indexArticleChunks(first, [chunkAt('velho')], [[0, 0]], 'openai/velho');
    store.indexArticleChunks(second, [chunkAt('outro')], [[0, 0]], 'openai/velho');

    store.indexArticleChunks(first, [chunkAt('novo')], [[1, 1]], 'openai/novo');

    expect(db.prepare('SELECT text_content AS t, embedding_model AS m FROM pdf_chunks ORDER BY t').all()).toEqual([
      { t: 'novo', m: 'openai/novo' },
      { t: 'outro', m: 'openai/velho' },
    ]);
    expect(rows('pdf_chunk_embeddings')).toBe(2);
  });

  it('refuses vectors of another size, keeping the whole index', () => {
    store.indexArticleChunks(first, [chunkAt('a')], [[0, 0]], 'openai/x');

    expect(() => store.indexArticleChunks(second, [chunkAt('b')], [[0, 0, 0]], 'openai/y')).toThrow(
      'holds 2 dimensions, got 3',
    );

    expect(rows('pdf_chunks')).toBe(1);
    expect(store.indexedDimension()).toBe(2);
  });

  it('replaces a vector table in the old format, which cannot take new rows', () => {
    db.exec('DROP TABLE IF EXISTS pdf_chunk_embeddings');
    db.exec('CREATE VIRTUAL TABLE pdf_chunk_embeddings USING vec0(id integer primary key, embedding float[2])');

    store.ensureVectorTable(2);

    const table = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'pdf_chunk_embeddings'").get() as {
      sql: string;
    };
    expect(table.sql.toLowerCase()).not.toContain('id integer primary key');
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
