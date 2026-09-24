import type { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * The PDF library: stored files (pdf_files, deduplicated by content hash) and their links to articles.
 *
 * Usage:
 *   new PdfLibraryRepository(db).linkPdfToArticle(articleId, '/storage/pdfs/x.pdf');
 */
export class PdfLibraryRepository {
  constructor(private db: Database) {}

  public getStoredPdfs(): unknown[] {
    const query = `
      SELECT p.file_path, p.file_hash, p.filename, p.file_size, p.created_at,
             (SELECT json_group_array(json_object('article_id', a.id, 'article_title', a.title, 'project_id', a.project_id, 'project_name', pr.name))
              FROM articles a
              JOIN projects pr ON a.project_id = pr.id
              WHERE LOWER(REPLACE(a.local_file_path, '/', '\\')) = LOWER(REPLACE(p.file_path, '/', '\\')) AND a.deleted_at IS NULL AND pr.deleted_at IS NULL
             ) as articles_json
      FROM pdf_files p
      ORDER BY p.created_at DESC
    `;
    const rows = this.db.prepare(query).all();
    return rows.map((r: any) => {
      const parsed = r.articles_json ? JSON.parse(r.articles_json) : [];
      const articles = Array.isArray(parsed) ? parsed.filter((art: any) => art && art.article_id != null) : [];
      return {
        ...r,
        articles,
      };
    });
  }

  public getArticlesForPdf(filePath: string): { id: number; title: string; project_id: number }[] {
    const query = 'SELECT id, title, project_id FROM articles WHERE local_file_path = ? AND deleted_at IS NULL';
    return this.db.prepare(query).all(filePath) as any;
  }

  public deletePdfRecord(filePath: string): void {
    this.db.prepare('DELETE FROM pdf_files WHERE file_path = ?').run(filePath);
  }

  public deletePdfLibraryRecord(filePath: string): number[] {
    const articles = this.getArticlesForPdf(filePath);
    const articleIds = articles.map((a) => a.id);

    const transaction = this.db.transaction(() => {
      for (const id of articleIds) {
        this.unlinkPdfFromArticle(id);
      }
      this.db.prepare('DELETE FROM pdf_files WHERE file_path = ?').run(filePath);
    });
    transaction();
    return articleIds;
  }

  public unlinkPdfFromArticle(articleId: number): void {
    const article = this.db.prepare('SELECT local_file_path FROM articles WHERE id = ?').get(articleId) as
      | { local_file_path: string | null }
      | undefined;
    if (!article || !article.local_file_path) return;

    const chunks = this.db.prepare('SELECT id FROM pdf_chunks WHERE article_id = ?').all(articleId) as { id: number }[];
    const chunkIds = chunks.map((c) => c.id);
    if (chunkIds.length > 0) {
      try {
        this.db.prepare(`DELETE FROM pdf_chunk_embeddings WHERE rowid IN (${chunkIds.join(',')})`).run();
      } catch (e) {}
      this.db.prepare('DELETE FROM pdf_chunks WHERE article_id = ?').run(articleId);
    }

    this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(articleId);
    this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(articleId);
    this.db.prepare('UPDATE articles SET local_file_path = NULL WHERE id = ?').run(articleId);
  }

  public backfillExistingPdfs(): void {
    try {
      const checkBackfill = this.db.prepare("SELECT value FROM settings WHERE key = 'backfilled_pdf_files'").get() as
        | { value: string }
        | undefined;
      if (checkBackfill?.value === 'true') return;

      const articles = this.db
        .prepare('SELECT id, local_file_path FROM articles WHERE local_file_path IS NOT NULL')
        .all() as { id: number; local_file_path: string }[];
      for (const art of articles) {
        this.processExistingPdf(art.id, art.local_file_path);
      }
      this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backfilled_pdf_files', 'true')").run();
    } catch (e) {
      console.error('Failed to backfill pdf_files:', e);
    }
  }

  private processExistingPdf(articleId: number, filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    try {
      const hash = this.getFileHash(filePath);
      const size = fs.statSync(filePath).size;
      const filename = path.basename(filePath);
      this.insertPdfRecord(filePath, hash, filename, size);
    } catch (e) {
      console.error('Error processing PDF for article:', e);
    }
  }

  private getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  private insertPdfRecord(filePath: string, hash: string, filename: string, size: number): void {
    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO pdf_files (file_path, file_hash, filename, file_size)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(filePath, hash, filename, size);
  }

  public linkPdfToArticle(articleId: number, filePath: string): void {
    const normalized = path.normalize(filePath);
    let pdf = this.db.prepare('SELECT * FROM pdf_files WHERE file_path = ?').get(normalized) as any;
    if (!pdf) {
      pdf = this.db
        .prepare("SELECT * FROM pdf_files WHERE LOWER(REPLACE(file_path, '/', '\\')) = LOWER(REPLACE(?, '/', '\\'))")
        .get(normalized) as any;
    }
    if (!pdf) {
      const filename = path.basename(filePath);
      pdf = this.db.prepare('SELECT * FROM pdf_files WHERE filename = ?').get(filename) as any;
    }
    if (!pdf) {
      throw new Error(`PDF file not found in library: "${filePath}"`);
    }
    this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?').run(pdf.file_path, articleId);
  }

  public registerPdfInLibrary(filePath: string, hash: string, filename: string, size: number): void {
    const normalized = path.normalize(filePath);
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO pdf_files (file_path, file_hash, filename, file_size)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(normalized, hash, filename, size);
  }

  public getPdfByHash(hash: string): any {
    return this.db.prepare('SELECT * FROM pdf_files WHERE file_hash = ?').get(hash);
  }
}
