/**
 * VectorStore unit tests — fully mocked (no native modules).
 *
 * WHY: `better-sqlite3` and `sqlite-vec` are native addons that fail to load
 * in parallel Vitest workers on Windows.  We mock the db at module level and
 * keep an in-memory store so indexArticleChunks / searchSimilar /
 * removeArticleChunks can be exercised end-to-end through VectorStore logic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { Database } from 'better-sqlite3';

let mockLoadablePath: string | null = null;
vi.mock('sqlite-vec', async (importOriginal) => {
  const original = await importOriginal<typeof import('sqlite-vec')>();
  return {
    ...original,
    getLoadablePath: () => mockLoadablePath || original.getLoadablePath(),
  };
});
import type { PdfTextChunk } from '../PdfExtractor';

// ---------------------------------------------------------------------------
// In-memory row types
// ---------------------------------------------------------------------------
interface ChunkRow {
  id: number;
  article_id: number;
  chunk_index: number;
  text_content: string;
  page_number: number;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  token_count: number | null;
}

interface EmbeddingRow {
  rowid: number;
  embedding: Float32Array;
}

// ---------------------------------------------------------------------------
// Shared in-memory storage — reset in beforeEach
// ---------------------------------------------------------------------------
let chunkRows: ChunkRow[] = [];
let embeddingRows: EmbeddingRow[] = [];
let nextChunkId = 1;

/** Tracks the sql string passed to the last exec() call. */
let lastExecSql = '';

/** Tracks whether the embeddings table "exists" in our virtual sqlite_master. */
let embeddingsTableExists = false;

/** The dimension currently stored (for the sqlite_master mock). */
let currentDimension = 0;

// ---------------------------------------------------------------------------
// Statement factories — each SQL pattern gets its own mock behaviour
// ---------------------------------------------------------------------------

/** Returns a mock Statement whose `.run` / `.get` / `.all` behave according
 *  to the SQL pattern that was "prepared". */
function buildStatement(sql: string): Database.Statement {
  const trimmed = sql.replace(/\s+/g, ' ').trim();

  // --- sqlite_master lookup used by ensureDimensionAndClearIfMismatched ---
  if (trimmed.includes('sqlite_master')) {
    return {
      run: vi.fn(),
      get: vi.fn(() => {
        if (!embeddingsTableExists) return undefined;
        return { sql: `CREATE VIRTUAL TABLE pdf_chunk_embeddings USING vec0(embedding float[${currentDimension}])` };
      }),
      all: vi.fn(() => []),
    } as unknown as Database.Statement;
  }

  // --- INSERT INTO pdf_chunks ---
  if (trimmed.includes('INSERT INTO pdf_chunks')) {
    return {
      run: vi.fn(
        (
          articleId: number,
          chunkIndex: number,
          text: string,
          page: number,
          bboxX: number,
          bboxY: number,
          bboxW: number,
          bboxH: number,
          tokenCount: number | null,
        ) => {
          const id = nextChunkId++;
          chunkRows.push({
            id,
            article_id: articleId,
            chunk_index: chunkIndex,
            text_content: text,
            page_number: page,
            bbox_x: bboxX,
            bbox_y: bboxY,
            bbox_w: bboxW,
            bbox_h: bboxH,
            token_count: tokenCount,
          });
          return { changes: 1, lastInsertRowid: id };
        },
      ),
      get: vi.fn(),
      all: vi.fn(),
    } as unknown as Database.Statement;
  }

  // --- INSERT INTO pdf_chunk_embeddings ---
  if (trimmed.includes('INSERT INTO pdf_chunk_embeddings')) {
    return {
      run: vi.fn((rowid: bigint, embedding: Float32Array) => {
        embeddingRows.push({ rowid: Number(rowid), embedding });
        return { changes: 1, lastInsertRowid: Number(rowid) };
      }),
      get: vi.fn(),
      all: vi.fn(),
    } as unknown as Database.Statement;
  }

  // --- SELECT id FROM pdf_chunks WHERE article_id = ? ---
  if (trimmed.includes('SELECT id FROM pdf_chunks')) {
    return {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn((articleId: number) =>
        chunkRows.filter((c) => c.article_id === articleId).map((c) => ({ id: c.id })),
      ),
    } as unknown as Database.Statement;
  }

  // --- DELETE FROM pdf_chunk_embeddings ---
  if (trimmed.includes('DELETE FROM pdf_chunk_embeddings')) {
    return {
      run: vi.fn(() => {
        // The real SQL has `WHERE rowid IN (...)` with literal ids baked in.
        // Parse them out of `trimmed`.
        const inMatch = trimmed.match(/IN\s*\(([^)]+)\)/i);
        if (inMatch) {
          const ids = inMatch[1].split(',').map(Number);
          embeddingRows = embeddingRows.filter((e) => !ids.includes(e.rowid));
        }
        return { changes: 1, lastInsertRowid: 0 };
      }),
      get: vi.fn(),
      all: vi.fn(),
    } as unknown as Database.Statement;
  }

  // --- DELETE FROM pdf_chunks WHERE article_id = ? ---
  if (trimmed.includes('DELETE FROM pdf_chunks')) {
    return {
      run: vi.fn((articleId: number) => {
        chunkRows = chunkRows.filter((c) => c.article_id !== articleId);
        return { changes: 1, lastInsertRowid: 0 };
      }),
      get: vi.fn(),
      all: vi.fn(),
    } as unknown as Database.Statement;
  }

  // --- searchSimilar MATCH query (first attempt) ---
  if (trimmed.includes('MATCH')) {
    return {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn((_embedding: Float32Array, topK: number, articleId: number) => {
        return searchInMemory(articleId, _embedding, topK);
      }),
    } as unknown as Database.Statement;
  }

  // --- searchSimilar fallback query (vec_distance_L2) ---
  if (trimmed.includes('vec_distance_L2')) {
    return {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn((_embedding: Float32Array, articleId: number, topK: number) => {
        return searchInMemory(articleId, _embedding, topK);
      }),
    } as unknown as Database.Statement;
  }

  // --- SELECT * FROM pdf_chunks (test assertion queries) ---
  if (trimmed.includes('SELECT * FROM pdf_chunks')) {
    return {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => [...chunkRows].sort((a, b) => a.chunk_index - b.chunk_index)),
    } as unknown as Database.Statement;
  }

  // --- SELECT rowid FROM pdf_chunk_embeddings (test assertion queries) ---
  if (trimmed.includes('SELECT rowid FROM pdf_chunk_embeddings')) {
    return {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => embeddingRows.map((e) => ({ rowid: e.rowid }))),
    } as unknown as Database.Statement;
  }

  // Fallback — return a no-op statement
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(() => []),
  } as unknown as Database.Statement;
}

/** Computes L2 distance between two Float32Arrays (or number[]). */
function l2Distance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Returns rows for searchSimilar, ranked by L2 distance. */
function searchInMemory(articleId: number, query: Float32Array, topK: number) {
  const articleChunks = chunkRows.filter((c) => c.article_id === articleId);
  const scored = articleChunks
    .map((chunk) => {
      const emb = embeddingRows.find((e) => e.rowid === chunk.id);
      const distance = emb ? l2Distance(query, emb.embedding) : Infinity;
      return {
        chunkId: chunk.id,
        text: chunk.text_content,
        page: chunk.page_number,
        bbox_x: chunk.bbox_x,
        bbox_y: chunk.bbox_y,
        bbox_w: chunk.bbox_w,
        bbox_h: chunk.bbox_h,
        similarityScore: distance,
      };
    })
    .sort((a, b) => a.similarityScore - b.similarityScore);
  return scored.slice(0, topK);
}

// ---------------------------------------------------------------------------
// Module-level mocks — prevent native-module resolution entirely
// ---------------------------------------------------------------------------
vi.mock('better-sqlite3', () => ({ default: vi.fn() }));
vi.mock('sqlite-vec', () => ({ default: { load: vi.fn() } }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('VectorStore', () => {
  let db: Database.Database;
  let store: ReturnType<typeof import('../VectorStore')['VectorStore']['prototype']['constructor']>;

  beforeEach(async () => {
    // Reset in-memory state
    chunkRows = [];
    embeddingRows = [];
    nextChunkId = 1;
    lastExecSql = '';
    embeddingsTableExists = false;
    currentDimension = 0;

    // Build a mock Database object
    db = {
      prepare: vi.fn((sql: string) => buildStatement(sql)),
      exec: vi.fn((sql: string) => {
        lastExecSql = sql;
        // Track whether the embeddings table was (re)created
        if (sql.includes('CREATE VIRTUAL TABLE pdf_chunk_embeddings')) {
          embeddingsTableExists = true;
          const dimMatch = sql.match(/float\[(\d+)\]/i);
          if (dimMatch) currentDimension = Number(dimMatch[1]);
        }
        if (sql.includes('DROP TABLE') && sql.includes('pdf_chunk_embeddings')) {
          embeddingsTableExists = false;
          embeddingRows = [];
        }
        if (sql.includes('DELETE FROM pdf_chunks')) {
          chunkRows = [];
        }
      }),
      transaction: vi.fn((cb: (...args: unknown[]) => void) => {
        // Must return a NEW function that calls cb — not call cb directly
        const wrapper = (...args: unknown[]) => cb(...args);
        return wrapper;
      }),
    } as unknown as Database.Database;

    const { VectorStore } = await import('../VectorStore');
    store = new VectorStore(db);
  });

  it('should index article chunks and embeddings', () => {
    const chunks: PdfTextChunk[] = [
      { text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } },
      { text: 'chunk2', page: 1, bbox: { x: 10, y: 10, w: 10, h: 10 } },
    ];
    const embeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];

    store.indexArticleChunks(1, chunks, embeddings);

    expect(chunkRows).toHaveLength(2);
    expect(chunkRows[0].text_content).toBe('chunk1');
    expect(embeddingRows).toHaveLength(2);
  });

  it('should throw when chunks and embeddings have different lengths', () => {
    const chunks: PdfTextChunk[] = [{ text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } }];
    expect(() => store.indexArticleChunks(1, chunks, [])).toThrow('same length');
  });

  it('should no-op when embeddings array is empty', () => {
    store.indexArticleChunks(1, [], []);
    expect(chunkRows).toHaveLength(0);
    expect(embeddingRows).toHaveLength(0);
  });

  it('should search similar chunks', () => {
    const chunks: PdfTextChunk[] = [
      { text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } },
      { text: 'chunk2', page: 1, bbox: { x: 10, y: 10, w: 10, h: 10 } },
    ];
    const embeddings = [
      [0.1, 0.2, 0.3],
      [0.9, 0.8, 0.7],
    ];
    store.indexArticleChunks(1, chunks, embeddings);

    const results = store.searchSimilar([0.1, 0.2, 0.3], 1, 1);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('chunk1');
  });

  it('should remove article chunks', () => {
    const chunks: PdfTextChunk[] = [{ text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } }];
    const embeddings = [[0.1, 0.2, 0.3]];
    store.indexArticleChunks(1, chunks, embeddings);

    store.removeArticleChunks(1);

    expect(chunkRows).toHaveLength(0);
    expect(embeddingRows).toHaveLength(0);
  });

  it('should create the embeddings table via ensureDimensionAndClearIfMismatched', () => {
    const cleared = store.ensureDimensionAndClearIfMismatched(128);
    expect(cleared).toBe(false);
    expect(embeddingsTableExists).toBe(true);
    expect(currentDimension).toBe(128);
  });

  it('should clear data when dimension mismatches', () => {
    // First call creates with dim=3
    store.ensureDimensionAndClearIfMismatched(3);
    // Manually add a chunk to verify it gets wiped
    chunkRows.push({
      id: 99,
      article_id: 1,
      chunk_index: 0,
      text_content: 'stale',
      page_number: 1,
      bbox_x: 0,
      bbox_y: 0,
      bbox_w: 0,
      bbox_h: 0,
      token_count: null,
    });

    const cleared = store.ensureDimensionAndClearIfMismatched(128);
    expect(cleared).toBe(true);
    expect(currentDimension).toBe(128);
    expect(chunkRows).toHaveLength(0);
  });
});
