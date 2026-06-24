import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { VectorStore } from '../VectorStore';
import { PdfTextChunk } from '../PdfExtractor';

describe('VectorStore', () => {
  let db: Database.Database;
  let store: VectorStore;

  beforeEach(() => {
    db = new Database(':memory:');
    try {
      sqliteVec.load(db);
    } catch (e) {
      console.log('Skipping sqliteVec load in test, or it loaded successfully');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT
      );
      INSERT INTO articles (id) VALUES (1);
      
      CREATE TABLE IF NOT EXISTS pdf_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_id INTEGER NOT NULL,
          chunk_index INTEGER NOT NULL,
          text_content TEXT NOT NULL,
          page_number INTEGER NOT NULL,
          bbox_x REAL,
          bbox_y REAL,
          bbox_w REAL,
          bbox_h REAL,
          token_count INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS pdf_chunk_embeddings USING vec0(
          embedding FLOAT[3]
      );
    `);

    store = new VectorStore(db);
  });

  it('should index article chunks and embeddings', () => {
    const chunks: PdfTextChunk[] = [
      { text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } },
      { text: 'chunk2', page: 1, bbox: { x: 10, y: 10, w: 10, h: 10 } },
    ];
    const embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];

    store.indexArticleChunks(1, chunks, embeddings);

    const savedChunks = db.prepare('SELECT * FROM pdf_chunks ORDER BY chunk_index ASC').all() as any[];
    expect(savedChunks).toHaveLength(2);
    expect(savedChunks[0].text_content).toBe('chunk1');

    const savedEmbeddings = db.prepare('SELECT rowid FROM pdf_chunk_embeddings').all();
    expect(savedEmbeddings).toHaveLength(2);
  });

  it('should search similar chunks', () => {
    const chunks: PdfTextChunk[] = [
      { text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } },
      { text: 'chunk2', page: 1, bbox: { x: 10, y: 10, w: 10, h: 10 } },
    ];
    const embeddings = [[0.1, 0.2, 0.3], [0.9, 0.8, 0.7]];
    store.indexArticleChunks(1, chunks, embeddings);

    const results = store.searchSimilar([0.1, 0.2, 0.3], 1, 1);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('chunk1');
  });

  it('should remove article chunks', () => {
    const chunks: PdfTextChunk[] = [
      { text: 'chunk1', page: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } }
    ];
    const embeddings = [[0.1, 0.2, 0.3]];
    store.indexArticleChunks(1, chunks, embeddings);

    store.removeArticleChunks(1);

    const savedChunks = db.prepare('SELECT * FROM pdf_chunks').all();
    expect(savedChunks).toHaveLength(0);

    const savedEmbeddings = db.prepare('SELECT rowid FROM pdf_chunk_embeddings').all();
    expect(savedEmbeddings).toHaveLength(0);
  });
});
