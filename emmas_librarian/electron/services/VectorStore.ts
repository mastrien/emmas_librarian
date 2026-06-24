import Database from 'better-sqlite3';
import { PdfTextChunk } from './PdfExtractor';

export interface SimilarChunk {
  chunkId: number;
  text: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  similarityScore: number;
}

/** Encapsula operações de busca vetorial no sqlite-vec. */
export class VectorStore {
  constructor(private readonly db: Database.Database) {}

  /** Garante que a tabela vec0 exista com a dimensão correta. Retorna true se teve que apagar o cache. */
  ensureDimensionAndClearIfMismatched(dim: number): boolean {
    const tableInfo = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pdf_chunk_embeddings'").get() as {sql: string} | undefined;
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

  /** Indexa chunks de um artigo (chamado na importação). */
  indexArticleChunks(articleId: number, chunks: PdfTextChunk[], embeddings: number[][]): void {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings must have the same length');
    }

    if (embeddings.length === 0) return;
    this.ensureDimensionAndClearIfMismatched(embeddings[0].length);

    const insertChunkStmt = this.db.prepare(`
      INSERT INTO pdf_chunks (article_id, chunk_index, text_content, page_number, bbox_x, bbox_y, bbox_w, bbox_h, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEmbeddingStmt = this.db.prepare(`
      INSERT INTO pdf_chunk_embeddings (rowid, embedding)
      VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
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
          null // token_count
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
    // vec_distance_L2 is commonly used in sqlite-vec
    const floatArray = new Float32Array(queryEmbedding);

    const stmt = this.db.prepare(`
      SELECT 
        c.id as chunkId,
        c.text_content as text,
        c.page_number as page,
        c.bbox_x as bbox_x,
        c.bbox_y as bbox_y,
        c.bbox_w as bbox_w,
        c.bbox_h as bbox_h,
        vec_distance_L2(e.embedding, ?) as similarityScore
      FROM pdf_chunk_embeddings e
      JOIN pdf_chunks c ON c.id = e.rowid
      WHERE c.article_id = ?
      ORDER BY similarityScore ASC
      LIMIT ?
    `);

    const rows = stmt.all(floatArray, articleId, topK) as any[];

    return rows.map((row) => ({
      chunkId: row.chunkId,
      text: row.text,
      page: row.page,
      bbox: {
        x: row.bbox_x,
        y: row.bbox_y,
        w: row.bbox_w,
        h: row.bbox_h,
      },
      // Lower L2 distance means higher similarity. You might map this to a score (e.g. 1 / (1 + distance)).
      similarityScore: row.similarityScore,
    }));
  }

  /** Remove chunks de um artigo (chamado na exclusão). */
  removeArticleChunks(articleId: number): void {
    const transaction = this.db.transaction(() => {
      // Find chunk IDs
      const chunks = this.db.prepare('SELECT id FROM pdf_chunks WHERE article_id = ?').all(articleId) as { id: number }[];
      const chunkIds = chunks.map((c) => c.id);

      if (chunkIds.length > 0) {
        // Delete embeddings
        const deleteEmbeddingsStmt = this.db.prepare(`DELETE FROM pdf_chunk_embeddings WHERE rowid IN (${chunkIds.join(',')})`);
        deleteEmbeddingsStmt.run();

        // Delete chunks
        const deleteChunksStmt = this.db.prepare('DELETE FROM pdf_chunks WHERE article_id = ?');
        deleteChunksStmt.run(articleId);
      }
    });

    transaction();
  }
}
