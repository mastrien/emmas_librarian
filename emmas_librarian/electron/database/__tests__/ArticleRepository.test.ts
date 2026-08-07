import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ArticleRepository } from '../ArticleRepository';



describe('ArticleRepository', () => {
  let db: Database.Database;
  let repo: ArticleRepository;
  let projectId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);

    db.exec(`
      ALTER TABLE articles ADD COLUMN abstract TEXT;
      ALTER TABLE articles ADD COLUMN author_keywords TEXT;
      ALTER TABLE articles ADD COLUMN index_keywords TEXT;
      ALTER TABLE articles ADD COLUMN journal TEXT;
      ALTER TABLE articles ADD COLUMN volume TEXT;
      ALTER TABLE articles ADD COLUMN issue TEXT;
      ALTER TABLE articles ADD COLUMN pages TEXT;
      ALTER TABLE articles ADD COLUMN affiliations TEXT;
      ALTER TABLE articles ADD COLUMN references_list TEXT;
      ALTER TABLE articles ADD COLUMN document_type TEXT;
      ALTER TABLE articles ADD COLUMN issn TEXT;
      ALTER TABLE articles ADD COLUMN citation_count INTEGER;
      ALTER TABLE articles ADD COLUMN search_id INTEGER;
      ALTER TABLE articles ADD COLUMN ai_summary TEXT;

      CREATE TABLE IF NOT EXISTS pdf_files (
          file_path TEXT PRIMARY KEY,
          file_hash TEXT,
          filename TEXT,
          file_size INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS pdf_chunk_embeddings (
          rowid INTEGER PRIMARY KEY,
          embedding BLOB
      );
    `);

    repo = new ArticleRepository(db);

    const projectInfo = db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)').run('Test Project', new Date().toISOString());
    projectId = Number(projectInfo.lastInsertRowid);

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (db) db.close();
    vi.restoreAllMocks();
  });

  describe('Articles', () => {
    it('should save a new article', () => {
      const id = repo.saveArticle(projectId, { title: 'Test Article', doi: '10.123/456', source_databases: '["pubmed"]' });
      expect(id).toBeDefined();

      const article = repo.getArticle(id);
      expect(article?.title).toBe('Test Article');
      expect(article?.doi).toBe('10.123/456');
    });

    it('should merge duplicate article when saving', () => {
      const id1 = repo.saveArticle(projectId, { title: 'Test Article', doi: '10.123/456', source_databases: '["pubmed"]' });
      const id2 = repo.saveArticle(projectId, { title: 'Test Article', doi: '10.123/456', source_databases: '["arxiv"]' });

      expect(id1).toBe(id2);
      const article = repo.getArticle(id1);
      const sources = JSON.parse(article?.source_databases || '[]');
      expect(sources).toContain('pubmed');
      expect(sources).toContain('arxiv');
    });

    it('should find duplicate by exact DOI', () => {
      repo.saveArticle(projectId, { title: 'Test', doi: ' 10.123 ' });
      const dup = repo.findDuplicateArticle(projectId, '10.123', 'Different Title');
      expect(dup).toBeDefined();
    });

    it('should find duplicate by exact title (case insensitive)', () => {
      repo.saveArticle(projectId, { title: 'Exact Title Match' });
      const dup = repo.findDuplicateArticle(projectId, null, 'exact TITLE match');
      expect(dup).toBeDefined();
    });

    it('should find duplicate by normalized title', () => {
      repo.saveArticle(projectId, { title: 'Special & Title! (2020)' });
      const dup = repo.findDuplicateArticle(projectId, null, 'Special and Title 2020'); // Normalization will strip &!(), but wait, normalizeTitleForDb strips non-alphanumeric and spaces.
      // Wait, let's use a simpler one.
      repo.saveArticle(projectId, { title: 'Título cõm Açentos' });
      const dup2 = repo.findDuplicateArticle(projectId, null, 'Titulo com Acentos');
      expect(dup2).toBeDefined();
    });
    
    it('should handle undefined title in normalizeTitleForDb', () => {
       const res = (repo as any).normalizeTitleForDb(undefined);
       expect(res).toBe('');
    });

    it('should return undefined for getArticle if project deleted', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' });
      db.prepare("UPDATE projects SET deleted_at = datetime('now') WHERE id = ?").run(projectId);
      expect(repo.getArticle(id)).toBeUndefined();
    });

    it('should get articles by project', () => {
      repo.saveArticle(projectId, { title: 'A1' });
      repo.saveArticle(projectId, { title: 'A2' });
      
      const articles = repo.getArticlesByProject(projectId);
      expect(articles).toHaveLength(2);
    });

    it('should update article file path and remove old file if different', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' } as any);
      repo.updateArticleFilePath(id, '/path/old.pdf');

      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      repo.updateArticleFilePath(id, '/path/new.pdf');
      
      expect(unlinkSpy).toHaveBeenCalledWith('/path/old.pdf');
      const article = repo.getArticle(id);
      expect(article?.local_file_path).toBe('/path/new.pdf');
      
      existsSpy.mockRestore();
      unlinkSpy.mockRestore();
    });

    it('should update article file path and not throw if unlink fails', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' } as any);
      repo.updateArticleFilePath(id, '/path/err.pdf');

      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw new Error('Err'); });

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      repo.updateArticleFilePath(id, '/path/new.pdf');
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
      existsSpy.mockRestore();
      unlinkSpy.mockRestore();
    });

    it('should update article status', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' });
      repo.updateArticleStatus(id, 'read', 'note');
      
      const article = repo.getArticle(id);
      expect(article?.status).toBe('read');
      expect(article?.archive_note).toBe('note');
    });

    it('should update article metadata', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' } as any);
      repo.updateArticleMetadata(id, { title: 'New Title', year: 2023, unknown: 'ignore' } as any);
      
      const article = repo.getArticle(id);
      expect(article?.title).toBe('New Title');
      expect(article?.year).toBe(2023);
    });

    it('should do nothing if updateArticleMetadata receives no valid fields', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' });
      repo.updateArticleMetadata(id, { unknown: 'ignore' } as any);
      
      const article = repo.getArticle(id);
      expect(article?.title).toBe('Test');
    });

    it('should update article ai summary', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' });
      repo.updateArticleAiSummary(id, 'Summary text');
      
      const article = repo.getArticle(id);
      expect(article?.ai_summary).toBe('Summary text');
    });

    it('should soft delete article', () => {
      const id = repo.saveArticle(projectId, { title: 'Test' });
      repo.deleteArticle(id);
      expect(repo.getArticle(id)).toBeUndefined();
    });
  });

  describe('Article Categories', () => {
    let articleId: number;
    let textCatId: number;
    let enumCatId: number;
    let opt1Id: number;
    let opt2Id: number;

    beforeEach(() => {
      articleId = repo.saveArticle(projectId, { title: 'Cat Article' });
      
      const res1 = db.prepare('INSERT INTO project_categories (project_id, name, type) VALUES (?, ?, ?)').run(projectId, 'TextCat', 'text');
      textCatId = Number(res1.lastInsertRowid);
      
      const res2 = db.prepare('INSERT INTO project_categories (project_id, name, type) VALUES (?, ?, ?)').run(projectId, 'EnumCat', 'multiselect');
      enumCatId = Number(res2.lastInsertRowid);

      opt1Id = Number(db.prepare('INSERT INTO project_category_options (category_id, name) VALUES (?, ?)').run(enumCatId, 'Opt1').lastInsertRowid);
      opt2Id = Number(db.prepare('INSERT INTO project_category_options (category_id, name) VALUES (?, ?)').run(enumCatId, 'Opt2').lastInsertRowid);
    });

    it('should return empty if category not found in setArticleCategory', () => {
      expect(() => repo.setArticleCategory(articleId, 999, 'val')).not.toThrow();
    });

    it('should set text category', () => {
      repo.setArticleCategory(articleId, textCatId, 'My Value');
      let cats = repo.getArticleCategories(articleId);
      expect(cats).toHaveLength(1);
      expect(cats[0].value).toBe('My Value');

      // Update existing
      repo.setArticleCategory(articleId, textCatId, 'New Value');
      cats = repo.getArticleCategories(articleId);
      expect(cats[0].value).toBe('New Value');

      // Delete if null or empty
      repo.setArticleCategory(articleId, textCatId, '');
      cats = repo.getArticleCategories(articleId);
      expect(cats).toHaveLength(0);
    });

    it('should set enum/multiselect category with array', () => {
      repo.setArticleCategory(articleId, enumCatId, [opt1Id, 'invalid'] as any);
      let cats = repo.getArticleCategories(articleId);
      expect(cats).toHaveLength(1);
      expect(cats[0].value).toBe('Opt1');
      expect((cats[0] as any).option_ids).toContain(opt1Id);
    });

    it('should set enum/multiselect category with comma separated string', () => {
      repo.setArticleCategory(articleId, enumCatId, `Opt1, ${opt2Id}, NotFound` as any);
      let cats = repo.getArticleCategories(articleId);
      expect(cats).toHaveLength(1);
      expect(cats[0].value).toBe('Opt1, Opt2');
      expect((cats[0] as any).option_ids).toContain(opt1Id);
      expect((cats[0] as any).option_ids).toContain(opt2Id);
    });

    it('should swallow errors when inserting invalid enum option', () => {
      // Mock db.prepare to throw for a specific insert
      const origPrepare = db.prepare.bind(db);
      vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO article_category_selections')) {
          return {
            run: () => { throw new Error('Constraint failed'); }
          } as any;
        }
        return origPrepare(sql);
      });

      repo.setArticleCategory(articleId, enumCatId, [opt1Id] as any);
      // Should not throw
      expect(true).toBe(true);
      vi.restoreAllMocks();
    });

    it('should get all project article categories', () => {
      repo.setArticleCategory(articleId, textCatId, 'TextVal');
      repo.setArticleCategory(articleId, enumCatId, [opt1Id] as any);

      const a2 = repo.saveArticle(projectId, { title: 'A2' });
      repo.setArticleCategory(a2, enumCatId, [opt2Id] as any);

      const all = repo.getAllProjectArticleCategories(projectId);
      expect(all.length).toBeGreaterThan(0);
      
      const t1 = all.find(a => (a as any).article_id === articleId && a.category_id === textCatId);
      expect(t1?.value).toBe('TextVal');

      const e2 = all.find(a => (a as any).article_id === a2 && a.category_id === enumCatId);
      expect(e2?.value).toBe('Opt2');
    });
  });

  describe('PDFs and Library', () => {
    it('should get stored pdfs', () => {
      db.prepare('INSERT INTO pdf_files (file_path, filename) VALUES (?, ?)').run('/test.pdf', 'test.pdf');
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.updateArticleFilePath(a1, '/test.pdf');
      
      const pdfs = repo.getStoredPdfs();
      expect(pdfs).toHaveLength(1);
      expect((pdfs[0] as any).articles).toHaveLength(1);
      expect((pdfs[0] as any).articles[0].article_title).toBe('A1');
    });

    it('should get articles for pdf', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.updateArticleFilePath(a1, '/test.pdf');
      const articles = repo.getArticlesForPdf('/test.pdf');
      expect(articles).toHaveLength(1);
      expect(articles[0].id).toBe(a1);
    });

    it('should delete pdf record', () => {
      db.prepare('INSERT INTO pdf_files (file_path, filename) VALUES (?, ?)').run('/del.pdf', 'del.pdf');
      repo.deletePdfRecord('/del.pdf');
      const row = db.prepare('SELECT * FROM pdf_files WHERE file_path = ?').get('/del.pdf');
      expect(row).toBeUndefined();
    });

    it('should unlink pdf from article', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.updateArticleFilePath(a1, '/test.pdf');
      db.prepare('INSERT INTO pdf_chunks (article_id, chunk_index, page_number, text_content) VALUES (?, ?, ?, ?)').run(a1, 0, 1, 'text');
      const chunkId = Number(db.prepare('SELECT last_insert_rowid()').get());
      // Fts or embeddings table usually need to be created if not in schema, assuming pdf_chunk_embeddings exists
      db.prepare('INSERT INTO pdf_chunk_embeddings (rowid, embedding) VALUES (?, ?)').run(chunkId, Buffer.from('emb'));

      repo.unlinkPdfFromArticle(a1);
      const article = repo.getArticle(a1);
      expect(article?.local_file_path).toBeNull();

      expect(db.prepare('SELECT * FROM pdf_chunks WHERE article_id = ?').all(a1)).toHaveLength(0);
    });

    it('should handle unlinkPdfFromArticle gracefully if article has no local_file_path', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' });
      expect(() => repo.unlinkPdfFromArticle(a1)).not.toThrow();
    });

    it('should delete pdf library record and unlink', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.updateArticleFilePath(a1, '/test.pdf');
      db.prepare('INSERT INTO pdf_files (file_path, filename) VALUES (?, ?)').run('/test.pdf', 'test.pdf');
      
      const unlinkedIds = repo.deletePdfLibraryRecord('/test.pdf');
      expect(unlinkedIds).toContain(a1);
      
      const article = repo.getArticle(a1);
      expect(article?.local_file_path).toBeNull();
      expect(db.prepare('SELECT * FROM pdf_files WHERE file_path = ?').get('/test.pdf')).toBeUndefined();
    });

    it('should register pdf in library', () => {
      repo.registerPdfInLibrary('/reg.pdf', 'hash123', 'reg.pdf', 100);
      const pdf = db.prepare('SELECT * FROM pdf_files WHERE file_path = ?').get(path.normalize('/reg.pdf')) as any;
      expect(pdf).toBeDefined();
      expect(pdf.file_hash).toBe('hash123');
    });

    it('should get pdf by hash', () => {
      db.prepare('INSERT INTO pdf_files (file_path, file_hash) VALUES (?, ?)').run('/h.pdf', 'myhash');
      const pdf = repo.getPdfByHash('myhash');
      expect(pdf.file_path).toBe('/h.pdf');
    });

    it('should link pdf to article (exact match)', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.registerPdfInLibrary('/link.pdf', 'h1', 'link.pdf', 10);
      repo.linkPdfToArticle(a1, '/link.pdf');
      expect(repo.getArticle(a1)?.local_file_path).toBe(path.normalize('/link.pdf'));
    });

    it('should link pdf to article (case insensitive match)', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' });
      repo.registerPdfInLibrary('C:/MyFolder/link.pdf', 'h1', 'link.pdf', 10);
      repo.linkPdfToArticle(a1, 'c:/myfolder/link.pdf');
      expect(repo.getArticle(a1)?.local_file_path).toBe(path.normalize('C:/MyFolder/link.pdf'));
    });

    it('should link pdf to article (filename match)', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.registerPdfInLibrary('/different/path/link.pdf', 'h1', 'link.pdf', 10);
      repo.linkPdfToArticle(a1, '/some/other/link.pdf');
      expect(repo.getArticle(a1)?.local_file_path).toBe(path.normalize('/different/path/link.pdf'));
    });

    it('should throw when linking pdf that is not found', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' });
      expect(() => repo.linkPdfToArticle(a1, '/not/found.pdf')).toThrow(/PDF file not found/);
    });

    it('should backfill existing pdfs', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.updateArticleFilePath(a1, '/backfill.pdf');
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('data'));
      const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ size: 123 } as any);

      repo.backfillExistingPdfs();

      const pdf = db.prepare('SELECT * FROM pdf_files WHERE file_path = ?').get('/backfill.pdf') as any;
      expect(pdf).toBeDefined();
      expect(pdf.file_size).toBe(123);
      
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'backfilled_pdf_files'").get() as any;
      expect(setting.value).toBe('true');
      
      existsSpy.mockRestore();
      readSpy.mockRestore();
      statSpy.mockRestore();
    });

    it('should not backfill if already backfilled', () => {
      db.prepare("INSERT INTO settings (key, value) VALUES ('backfilled_pdf_files', 'true')").run();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      repo.backfillExistingPdfs();

      // Since mock fs is not called, we know it skipped
      expect(existsSpy).not.toHaveBeenCalled();
      consoleError.mockRestore();
      existsSpy.mockRestore();
    });

    it('should swallow error in processExistingPdf', () => {
      const a1 = repo.saveArticle(projectId, { title: 'A1' } as any);
      repo.updateArticleFilePath(a1, '/err.pdf');
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('Err'); });

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      repo.backfillExistingPdfs();
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
      existsSpy.mockRestore();
      readSpy.mockRestore();
    });

    it('should handle getFileHashAsync', async () => {
      const EventEmitter = require('events');
      const stream = new EventEmitter();
      const streamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue(stream as any);

      const promise = (repo as any).getFileHashAsync('/async.pdf');
      stream.emit('data', Buffer.from('data'));
      stream.emit('end');

      const hash = await promise;
      expect(hash).toBe(crypto.createHash('sha256').update(Buffer.from('data')).digest('hex'));
      streamSpy.mockRestore();
    });

    it('should handle getFileHashAsync error', async () => {
      const EventEmitter = require('events');
      const stream = new EventEmitter();
      const streamSpy = vi.spyOn(fs, 'createReadStream').mockReturnValue(stream as any);

      const promise = (repo as any).getFileHashAsync('/async.pdf');
      stream.emit('error', new Error('stream error'));

      await expect(promise).rejects.toThrow('stream error');
      streamSpy.mockRestore();
    });
  });

  describe('Clone/Import Articles', () => {
    it('should import articles from another project', () => {
      const destProject = Number(db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)').run('Dest', new Date().toISOString()).lastInsertRowid);
      
      const a1 = repo.saveArticle(projectId, { title: 'A1' });
      db.prepare('INSERT INTO pdf_chunks (article_id, chunk_index, page_number, text_content) VALUES (?, ?, ?, ?)').run(a1, 0, 1, 'chunk');
      const chunkId = Number(db.prepare('SELECT last_insert_rowid()').get());
      db.prepare('INSERT INTO pdf_chunk_embeddings (rowid, embedding) VALUES (?, ?)').run(chunkId, Buffer.from('emb'));

      repo.importArticlesFromProject(projectId, destProject, [a1], 99);

      const destArticles = repo.getArticlesByProject(destProject);
      expect(destArticles).toHaveLength(1);
      expect(destArticles[0].title).toBe('A1');
      expect(destArticles[0].search_id).toBe(99);

      const newChunks = db.prepare('SELECT * FROM pdf_chunks WHERE article_id = ?').all(destArticles[0].id) as any[];
      expect(newChunks).toHaveLength(1);
      
      const newChunkId = newChunks[0].id;
      const newEmb = db.prepare('SELECT embedding FROM pdf_chunk_embeddings WHERE rowid = ?').get(newChunkId) as any;
      expect(newEmb).toBeDefined();
    });

    it('should gracefully handle importing a non-existent article', () => {
      expect(() => repo.importArticlesFromProject(projectId, 999, [888], 99)).not.toThrow();
    });
  });
});
