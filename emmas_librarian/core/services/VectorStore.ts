import Database from 'better-sqlite3';
import { PdfTextChunk } from './PdfExtractor';

export interface SimilarChunk {
  chunkId: number;
  articleId: number;
  text: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  similarityScore: number;
}

interface SimilarChunkRow {
  chunkId: number;
  articleId: number;
  text: string;
  page: number;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  similarityScore: number;
}

const CHUNK_COLUMNS = `c.id as chunkId, c.article_id as articleId, c.text_content as text, c.page_number as page,
  c.bbox_x as bbox_x, c.bbox_y as bbox_y, c.bbox_w as bbox_w, c.bbox_h as bbox_h`;

const toSimilarChunk = (row: SimilarChunkRow): SimilarChunk => ({
  chunkId: row.chunkId,
  articleId: row.articleId,
  text: row.text,
  page: row.page,
  bbox: { x: row.bbox_x, y: row.bbox_y, w: row.bbox_w, h: row.bbox_h },
  similarityScore: row.similarityScore,
});

/** Encapsula operações de busca vetorial no sqlite-vec. */
export class VectorStore {
  constructor(private readonly db: Database.Database) {}

  /**
   * Creates the vector table at this size, clearing the whole index if it holds another size. Only for when the person
   * asked for it (recalculating with a model of another size): changing a setting or running a search never gets here.
   *
   * @example if (store.ensureDimensionAndClearIfMismatched(768)) console.log('índice refeito');
   */
  ensureDimensionAndClearIfMismatched(dim: number): boolean {
    const tableInfo = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pdf_chunk_embeddings'")
      .get() as { sql: string } | undefined;
    if (!tableInfo) {
      this.db.exec(`CREATE VIRTUAL TABLE pdf_chunk_embeddings USING vec0(embedding float[${dim}])`);
      return false;
    } else if (!tableInfo.sql.includes(`[${dim}]`) || tableInfo.sql.toLowerCase().includes('id integer primary key')) {
      this.db.exec(`
        DROP TABLE IF EXISTS pdf_chunk_embeddings;
        CREATE VIRTUAL TABLE pdf_chunk_embeddings USING vec0(embedding float[${dim}]);
        DELETE FROM pdf_chunks;
      `);
      return true;
    }
    return false;
  }

  /**
   * Makes sure vectors of this size can go in, and refuses when they cannot, keeping the index. A table in the old
   * format is replaced: it cannot take new rows, and what it holds has no known model, so it would be recalculated.
   *
   * @example store.ensureVectorTable(1536);
   */
  ensureVectorTable(dim: number): void {
    const indexed = this.indexedDimension();
    const oldFormat = this.vectorTableSql()?.toLowerCase().includes('id integer primary key');
    if (indexed === null || oldFormat) {
      this.ensureDimensionAndClearIfMismatched(dim);
      return;
    }
    if (indexed !== dim) {
      throw new Error(`The vector table holds ${indexed} dimensions, got ${dim}. Expected the same size.`);
    }
  }

  /** Indexa chunks de um artigo, substituindo os que ele já tenha: ou fica tudo do modelo novo, ou nada muda. */
  indexArticleChunks(
    articleId: number,
    chunks: PdfTextChunk[],
    embeddings: number[][],
    embeddingModel: string | null = null,
  ): void {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings must have the same length');
    }

    if (embeddings.length === 0) return;
    this.ensureVectorTable(embeddings[0].length);

    const insertChunkStmt = this.db.prepare(`
      INSERT INTO pdf_chunks (article_id, chunk_index, text_content, page_number, bbox_x, bbox_y, bbox_w, bbox_h, token_count, embedding_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEmbeddingStmt = this.db.prepare(`
      INSERT INTO pdf_chunk_embeddings (rowid, embedding)
      VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
      this.removeArticleChunks(articleId);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        const info = insertChunkStmt.run(
          articleId,
          i,
          chunk.text,
          chunk.page,
          chunk.bbox.x,
          chunk.bbox.y,
          chunk.bbox.w,
          chunk.bbox.h,
          null, // token_count
          embeddingModel,
        );

        const chunkId = info.lastInsertRowid;

        // Serialize the embedding array to JSON for vec0 if needed, or Float32Array
        // sqlite-vec expects embedding as JSON array or Float32Array blob
        const floatArray = new Float32Array(embedding);
        insertEmbeddingStmt.run(BigInt(chunkId), floatArray);
      }
    });

    transaction();
  }

  /** Busca os K chunks mais similares à query em um artigo específico. */
  searchSimilar(queryEmbedding: number[], topK: number, articleId: number): SimilarChunk[] {
    return this.nearest(queryEmbedding, topK, [articleId]);
  }

  /**
   * The nearest chunks among several articles, nearest first (#53). Nothing is indexed yet: no chunks.
   *
   * @example store.searchSimilarAcross(vector, 20, [1, 2, 3]);
   */
  searchSimilarAcross(queryEmbedding: number[], topK: number, articleIds: number[]): SimilarChunk[] {
    if (articleIds.length === 0 || this.indexedDimension() === null) return [];
    return this.nearest(queryEmbedding, topK, articleIds);
  }

  /**
   * The size of the indexed vectors, or null before the first indexing. Only reads, unlike
   * ensureDimensionAndClearIfMismatched, which clears the index when the size differs.
   *
   * @example store.indexedDimension() // 1536
   */
  indexedDimension(): number | null {
    const size = this.vectorTableSql()?.match(/float\[(\d+)\]/);
    return size ? Number(size[1]) : null;
  }

  private vectorTableSql(): string | undefined {
    const table = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pdf_chunk_embeddings'")
      .get() as { sql: string } | undefined;
    return table?.sql;
  }

  private nearest(queryEmbedding: number[], topK: number, articleIds: number[]): SimilarChunk[] {
    const floatArray = new Float32Array(queryEmbedding);
    const ids = JSON.stringify(articleIds);
    try {
      const rows = this.nearestByIndex(floatArray, topK, ids);
      if (rows.length > 0) return rows.map(toSimilarChunk);
    } catch {
      // Fallback query if MATCH clause isn't supported by the loaded virtual table format
    }
    return this.nearestByDistance(floatArray, topK, ids).map(toSimilarChunk);
  }

  // The article goes in as a rowid filter because vec0 applies it ahead of the search. As a plain condition on the
  // joined chunks it ran after: k picked the nearest of the whole library, and the article kept only those of its
  // own that were among them, down to 1 chunk of 10 asked.
  private nearestByIndex(query: Float32Array, topK: number, articleIds: string): SimilarChunkRow[] {
    return this.db
      .prepare(
        `SELECT ${CHUNK_COLUMNS}, e.distance as similarityScore
         FROM pdf_chunk_embeddings e
         JOIN pdf_chunks c ON c.id = e.rowid
         WHERE e.embedding MATCH ? AND k = ?
           AND e.rowid IN (SELECT id FROM pdf_chunks WHERE article_id IN (SELECT value FROM json_each(?)))
         ORDER BY e.distance ASC`,
      )
      .all(query, topK, articleIds) as SimilarChunkRow[];
  }

  private nearestByDistance(query: Float32Array, topK: number, articleIds: string): SimilarChunkRow[] {
    return this.db
      .prepare(
        `SELECT ${CHUNK_COLUMNS}, vec_distance_L2(e.embedding, ?) as similarityScore
         FROM pdf_chunk_embeddings e
         JOIN pdf_chunks c ON c.id = e.rowid
         WHERE c.article_id IN (SELECT value FROM json_each(?))
         ORDER BY similarityScore ASC
         LIMIT ?`,
      )
      .all(query, articleIds, topK) as SimilarChunkRow[];
  }

  /** Remove chunks de um artigo (chamado na exclusão). */
  removeArticleChunks(articleId: number): void {
    const transaction = this.db.transaction(() => {
      // Find chunk IDs
      const chunks = this.db.prepare('SELECT id FROM pdf_chunks WHERE article_id = ?').all(articleId) as {
        id: number;
      }[];
      const chunkIds = chunks.map((c) => c.id);

      if (chunkIds.length > 0) {
        // Delete embeddings
        const deleteEmbeddingsStmt = this.db.prepare(
          `DELETE FROM pdf_chunk_embeddings WHERE rowid IN (${chunkIds.join(',')})`,
        );
        deleteEmbeddingsStmt.run();

        // Delete chunks
        const deleteChunksStmt = this.db.prepare('DELETE FROM pdf_chunks WHERE article_id = ?');
        deleteChunksStmt.run(articleId);
      }
    });

    transaction();
  }
}
