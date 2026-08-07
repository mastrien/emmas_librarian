import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ProjectRepository } from './ProjectRepository';
import { SettingsRepository } from './SettingsRepository';
import { ArticleRepository } from './ArticleRepository';
import { HistoryRepository } from './HistoryRepository';
import { DocumentRepository } from './DocumentRepository';
import { AnnotationRepository } from './AnnotationRepository';
import { TrashRepository } from './TrashRepository';
import { MassiveInvestigationRepository } from './MassiveInvestigationRepository';

import { safeStorage } from 'electron';
import { Project, Article, Annotation, Highlight, DiaryEntry, ProjectDocument, ProjectCategory, ArticleCategory, CategoryOption } from '../../src/types';

interface TableInfoRow {
  name: string;
}

export interface ArticleInput {
  doi?: string;
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  author_keywords?: string;
  index_keywords?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  affiliations?: string;
  references_list?: string;
  document_type?: string;
  issn?: string;
  citation_count?: number;
  source_query: string;
  source_databases: string;
  csl_json: string;
  search_id?: number;
  is_oa?: number;
  publisher?: string;
  url?: string;
  accessed?: string;
}

export type HighlightWithComment = Highlight & { comment?: string };

export class DatabaseAdapter {
  private db: Database.Database;

  public projectRepo: ProjectRepository;
  public settingsRepo: SettingsRepository;
  public articleRepo: ArticleRepository;
  public historyRepo: HistoryRepository;
  public documentRepo: DocumentRepository;
  public annotationRepo: AnnotationRepository;
  public trashRepo: TrashRepository;
  public investigationRepo: MassiveInvestigationRepository;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.loadSqliteVec(this.db);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.projectRepo = new ProjectRepository(this.db);
    this.settingsRepo = new SettingsRepository(this.db);
    this.articleRepo = new ArticleRepository(this.db);
    this.historyRepo = new HistoryRepository(this.db);
    this.documentRepo = new DocumentRepository(this.db);
    this.annotationRepo = new AnnotationRepository(this.db);
    this.trashRepo = new TrashRepository(this.db, this.projectRepo);
    this.investigationRepo = new MassiveInvestigationRepository(this.db);

    this.initSchema();
  }

  private loadSqliteVec(db: Database.Database): void {
    try {
      let loadablePath = sqliteVec.getLoadablePath();
      if (
        loadablePath.toLowerCase().includes('app.asar') &&
        !loadablePath.toLowerCase().includes('app.asar.unpacked')
      ) {
        loadablePath = loadablePath.replace(/app\.asar/i, 'app.asar.unpacked');
      }
      db.loadExtension(loadablePath);
    } catch (err) {
      console.error('Failed to load sqlite-vec extension', err);
    }
  }

  public getDB(): Database.Database {
    return this.db;
  }

  private initSchema() {
    // Determine the right path for schema.sql whether running compiled, in dev, or in tests
    const possiblePaths = [
      path.join(__dirname, 'schema.sql'), // compiled dist-electron/database/schema.sql or test from __dirname
      path.join(__dirname, '..', '..', 'electron', 'database', 'schema.sql'), // from dist-electron (if __dirname is dist-electron)
      path.join(__dirname, '..', '..', '..', 'electron', 'database', 'schema.sql'), // from nested dist-electron/electron/database
      path.join(process.cwd(), 'electron', 'database', 'schema.sql'), // test from frontend root
    ];

    let schemaStr = '';
    let found = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        schemaStr = fs.readFileSync(p, 'utf-8');
        found = true;
        break;
      }
    }

    if (!found) throw new Error('Could not find schema.sql. Checked: ' + possiblePaths.join(', '));

    this.db.exec(schemaStr);

    const migrations = [
      'ALTER TABLE articles ADD COLUMN archive_note TEXT',
      'ALTER TABLE articles ADD COLUMN abstract TEXT',
      'ALTER TABLE articles ADD COLUMN author_keywords TEXT',
      'ALTER TABLE articles ADD COLUMN index_keywords TEXT',
      'ALTER TABLE articles ADD COLUMN journal TEXT',
      'ALTER TABLE articles ADD COLUMN volume TEXT',
      'ALTER TABLE articles ADD COLUMN issue TEXT',
      'ALTER TABLE articles ADD COLUMN pages TEXT',
      'ALTER TABLE articles ADD COLUMN affiliations TEXT',
      'ALTER TABLE articles ADD COLUMN references_list TEXT',
      'ALTER TABLE articles ADD COLUMN document_type TEXT',
      'ALTER TABLE articles ADD COLUMN issn TEXT',
      'ALTER TABLE articles ADD COLUMN citation_count INTEGER',
      'ALTER TABLE articles ADD COLUMN search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL',
      'ALTER TABLE articles ADD COLUMN ai_summary TEXT',
      'ALTER TABLE projects ADD COLUMN writing_pad TEXT',
      'ALTER TABLE articles ADD COLUMN is_oa INTEGER',
      'ALTER TABLE articles ADD COLUMN publisher TEXT',
      'ALTER TABLE articles ADD COLUMN url TEXT',
      'ALTER TABLE articles ADD COLUMN accessed TEXT',
      'ALTER TABLE projects ADD COLUMN deleted_at DATETIME DEFAULT NULL',
      'ALTER TABLE articles ADD COLUMN deleted_at DATETIME DEFAULT NULL',
      'ALTER TABLE annotations ADD COLUMN deleted_at DATETIME DEFAULT NULL',
      `CREATE TABLE IF NOT EXISTS project_diary_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          entry_date TEXT NOT NULL,
          content TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'ALTER TABLE search_history ADD COLUMN sort_by TEXT',
      'ALTER TABLE search_history ADD COLUMN limit_val INTEGER',
      'ALTER TABLE project_documents ADD COLUMN position INTEGER DEFAULT 0',
      'ALTER TABLE project_documents ADD COLUMN category TEXT DEFAULT NULL',
    ];
    for (const sql of migrations) {
      try {
        this.db.exec(sql);
      } catch (e) {
        /* column already exists */
      }
    }

    // One-time backfill of is_oa and publisher columns from csl_json for existing articles
    try {
      const checkBackfill = this.db
        .prepare("SELECT value FROM settings WHERE key = 'backfilled_is_oa_publisher'")
        .get() as { value: string } | undefined;
      if (!checkBackfill || checkBackfill.value !== 'true') {
        const articlesToBackfill = this.db
          .prepare(
            `
          SELECT id, csl_json FROM articles WHERE csl_json IS NOT NULL
        `,
          )
          .all() as { id: number; csl_json: string }[];

        if (articlesToBackfill.length > 0) {
          const updateStmt = this.db.prepare(`
            UPDATE articles SET is_oa = ?, publisher = ? WHERE id = ?
          `);

          const transaction = this.db.transaction((items) => {
            for (const art of items) {
              try {
                const csl = JSON.parse(art.csl_json);
                let isOa = csl.is_oa !== undefined ? (csl.is_oa ? 1 : 0) : null;
                let publisher = csl.publisher || null;
                updateStmt.run(isOa, publisher, art.id);
              } catch (e) {}
            }
          });
          transaction(articlesToBackfill);
        }

        this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backfilled_is_oa_publisher', 'true')")
          .run();
      }
    } catch (err) {
      console.error('Failed to backfill articles is_oa/publisher:', err);
    }

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pending_highlights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            quote TEXT NOT NULL,
            context_before TEXT,
            context_after TEXT,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      console.error('Migration pending_highlights error', e);
    }
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS massive_investigations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            questions TEXT NOT NULL,
            articles_ids TEXT NOT NULL,
            model_used TEXT,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      console.error('Migration massive_investigations error', e);
    }

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS project_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'text',
            options TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_category_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS article_categories (
            article_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            value TEXT,
            PRIMARY KEY(article_id, category_id),
            FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS article_category_selections (
            article_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            option_id INTEGER NOT NULL,
            PRIMARY KEY(article_id, category_id, option_id),
            FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
            FOREIGN KEY(option_id) REFERENCES project_category_options(id) ON DELETE CASCADE
        );
      `);

      const pcInfo = this.db.pragma('table_info(project_categories)') as TableInfoRow[];
      if (!pcInfo.some((col) => col.name === 'options')) {
        this.db.exec(`ALTER TABLE project_categories ADD COLUMN options TEXT;`);
      }

      // Migração de dados de options para IDs relacionais
      const checkBackfill = this.db
        .prepare("SELECT value FROM settings WHERE key = 'backfilled_category_options'")
        .get() as { value: string } | undefined;
      if (!checkBackfill || checkBackfill.value !== 'true') {
        const transaction = this.db.transaction(() => {
          const cats = this.db
            .prepare("SELECT id, type, options FROM project_categories WHERE type IN ('enum', 'multiselect')")
            .all() as { id: number; type: string; options?: string }[];
          const insertOptionStmt = this.db.prepare(
            'INSERT INTO project_category_options (category_id, name) VALUES (?, ?)',
          );
          const insertSelectionStmt = this.db.prepare(
            'INSERT INTO article_category_selections (article_id, category_id, option_id) VALUES (?, ?, ?)',
          );

          for (const cat of cats) {
            if (cat.options) {
              const opts = cat.options
                .split(',')
                .map((o: string) => o.trim())
                .filter(Boolean);
              const optionMap = new Map<string, number>();

              for (const opt of opts) {
                const res = insertOptionStmt.run(cat.id, opt);
                optionMap.set(opt, res.lastInsertRowid as number);
              }

              const assignments = this.db
                .prepare('SELECT article_id, value FROM article_categories WHERE category_id = ?')
                .all(cat.id) as { article_id: number; value?: string }[];
              for (const assign of assignments) {
                if (assign.value) {
                  const selectedOpts = assign.value
                    .split(',')
                    .map((o: string) => o.trim())
                    .filter(Boolean);
                  for (const selected of selectedOpts) {
                    let optId = optionMap.get(selected);
                    if (!optId) {
                      const res = insertOptionStmt.run(cat.id, selected);
                      optId = res.lastInsertRowid as number;
                      optionMap.set(selected, optId);
                    }
                    try {
                      insertSelectionStmt.run(assign.article_id, cat.id, optId);
                    } catch (e) {} // duplicate ignore
                  }
                }
              }
            }
          }
        });
        transaction();
        this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backfilled_category_options', 'true')")
          .run();
      }
    } catch (e) {
      console.error('Migration categories error', e);
    }

    try {
      const checkVecMigration = this.db
        .prepare("SELECT value FROM settings WHERE key = 'migrated_vec_dimensions_v3'")
        .get() as { value: string } | undefined;

      if (!checkVecMigration || checkVecMigration.value !== 'true') {
        const transaction = this.db.transaction(() => {
          this.db.exec(`
            DROP TABLE IF EXISTS pdf_chunk_embeddings;
            DROP TABLE IF EXISTS pdf_chunks;
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
            );
          `);
        });
        transaction();
        this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('migrated_vec_dimensions_v3', 'true')")
          .run();
      }
    } catch (e) {
      console.error('Migration sqlite-vec dimensions error', e);
    }

    try {
      const miInfo = this.db.pragma('table_info(massive_investigations)') as TableInfoRow[];
      if (!miInfo.some((col) => col.name === 'model_used')) {
        this.db.prepare('ALTER TABLE massive_investigations ADD COLUMN model_used TEXT').run();
      }
      if (!miInfo.some((col) => col.name === 'status')) {
        this.db.prepare('ALTER TABLE massive_investigations ADD COLUMN status TEXT').run();
      }

      const hlInfo = this.db.pragma('table_info(highlights)') as TableInfoRow[];
      if (!hlInfo.some((col) => col.name === 'content_text')) {
        this.db.prepare('ALTER TABLE highlights ADD COLUMN content_text TEXT').run();
      }

      // Deduplicate project_diary entries (keep the latest one)
      this.db.exec(`
        DELETE FROM project_diary 
        WHERE id NOT IN (
          SELECT MAX(id) 
          FROM project_diary 
          GROUP BY project_id, entry_date
        );
      `);

      // Enforce unique project_diary entries by index, in case the constraint was missing in older schemas
      this.db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_project_diary_unique 
        ON project_diary(project_id, entry_date);
      `);

      // PDF Library table migration
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            file_hash TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Run PDF backfill
      // Run PDF backfill
      this.articleRepo.backfillExistingPdfs();
    } catch (e) {
      console.error('Schema migrations error', e);
    }
  }

  // --- Project ---
  createProject(name: string): Project { return this.projectRepo.createProject(name); }
  getProject(id: number): Project | undefined { return this.projectRepo.getProject(id); }
  updateProjectWritingPad(id: number, content: string) { return this.projectRepo.updateProjectWritingPad(id, content); }
  getProjectWritingPad(id: number): string | null { return this.projectRepo.getProjectWritingPad(id); }
  updateProject(id: number, name: string): void { return this.projectRepo.updateProject(id, name); }
  deleteProject(id: number): void { return this.projectRepo.deleteProject(id); }
  deleteProjectPermanent(id: number): void { return this.projectRepo.deleteProjectPermanent(id); }
  getAllProjects(): Project[] { return this.projectRepo.getAllProjects(); }

  // --- Article ---
  findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined { return this.articleRepo.findDuplicateArticle(projectId, doi, title); }
  saveArticle(projectId: number, data: ArticleInput): number { return this.articleRepo.saveArticle(projectId, data); }
  getArticle(id: number): Article | undefined { return this.articleRepo.getArticle(id); }
  getArticlesByProject(projectId: number): Article[] { return this.articleRepo.getArticlesByProject(projectId); }
  updateArticleFilePath(articleId: number, path: string | null): void { return this.articleRepo.updateArticleFilePath(articleId, path); }
  updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', archiveNote?: string): void { return this.articleRepo.updateArticleStatus(articleId, status, archiveNote); }
  updateArticleMetadata(articleId: number, data: Partial<ArticleInput>): void { return this.articleRepo.updateArticleMetadata(articleId, data); }
  updateArticleAiSummary(articleId: number, summary: string): void { return this.articleRepo.updateArticleAiSummary(articleId, summary); }
  deleteArticle(id: number): void { return this.articleRepo.deleteArticle(id); }

  // --- Annotation & Highlight ---
  saveAnnotation(articleId: number, content: string): number { return this.annotationRepo.saveAnnotation(articleId, content); }
  getAnnotations(articleId: number): Annotation[] { return this.annotationRepo.getAnnotations(articleId); }
  updateAnnotation(id: number, content: string): void { return this.annotationRepo.updateAnnotation(id, content); }
  deleteAnnotation(id: number): void { return this.annotationRepo.deleteAnnotation(id); }
  saveHighlight(articleId: number, color: string, positionData: string, contentText: string | null, annotationId?: number): number { return this.annotationRepo.saveHighlight(articleId, color, positionData, contentText, annotationId); }
  getHighlights(articleId: number): HighlightWithComment[] { return this.annotationRepo.getHighlights(articleId); }
  deleteHighlight(id: number): void { return this.annotationRepo.deleteHighlight(id); }
  savePendingHighlight(articleId: number, quote: string, contextBefore: string, contextAfter: string, comment: string): number { return this.annotationRepo.savePendingHighlight(articleId, quote, contextBefore, contextAfter, comment); }
  getPendingHighlights(articleId: number): Highlight[] { return this.annotationRepo.getPendingHighlights(articleId); }
  deletePendingHighlight(id: number): void { return this.annotationRepo.deletePendingHighlight(id); }

  // --- Massive Investigation ---
  saveMassiveInvestigation(projectId: number, questions: string[], articlesIds: number[], modelUsed: string, status: string): number { return this.investigationRepo.saveMassiveInvestigation(projectId, questions, articlesIds, modelUsed, status); }
  getMassiveInvestigations(projectId: number): unknown[] { return this.investigationRepo.getMassiveInvestigations(projectId); }

  // --- Settings ---
  public getSetting(key: string): string | null { return this.settingsRepo.getSetting(key); }
  public setSetting(key: string, value: string): void { return this.settingsRepo.setSetting(key, value); }

  // --- History ---
  public saveSearchHistory(projectId: number, unifiedQuery: string, translatedQueries: Record<string, string>, totalResults: number, breakdown: Record<string, unknown>, sortBy?: string, limitVal?: number): number { return this.historyRepo.saveSearchHistory(projectId, unifiedQuery, translatedQueries, totalResults, breakdown, sortBy, limitVal); }
  public getSearchHistory(projectId: number): unknown[] { return this.historyRepo.getSearchHistory(projectId); }
  public revertSearch(searchId: number): void { return this.historyRepo.revertSearch(searchId); }
  public saveDiaryEntry(projectId: number, entryDate: string, content: string): void { return this.historyRepo.saveDiaryEntry(projectId, entryDate, content); }
  public getDiaryEntries(projectId: number): DiaryEntry[] { return this.historyRepo.getDiaryEntries(projectId); }
  public getDiaryEntry(projectId: number, entryDate: string): DiaryEntry | undefined { return this.historyRepo.getDiaryEntry(projectId, entryDate); }
  public deleteDiaryEntry(projectId: number, entryDate: string): void { return this.historyRepo.deleteDiaryEntry(projectId, entryDate); }
  public getDiaryEntryHistory(projectId: number, entryDate: string): unknown[] { return this.historyRepo.getDiaryEntryHistory(projectId, entryDate); }
  public restoreDiaryEntryVersion(versionId: number): void { return this.historyRepo.restoreDiaryEntryVersion(versionId); }

  // --- Documents ---
  public saveProjectDocument(projectId: number, title: string, url?: string | null, localFilePath?: string | null, category?: string | null): number { return this.documentRepo.saveProjectDocument(projectId, title, url, localFilePath, category); }
  public getProjectDocuments(projectId: number): ProjectDocument[] { return this.documentRepo.getProjectDocuments(projectId); }
  public updateProjectDocument(id: number, title: string, url: string | null, localFilePath: string | null, category: string | null): void { return this.documentRepo.updateProjectDocument(id, title, url, localFilePath, category); }
  public reorderProjectDocuments(projectId: number, orderedIds: number[]): void { return this.documentRepo.reorderProjectDocuments(projectId, orderedIds); }
  public deleteProjectDocument(id: number): void { return this.documentRepo.deleteProjectDocument(id); }

  // --- Categories ---
  public getProjectCategories(projectId: number): ProjectCategory[] { return this.projectRepo.getProjectCategories(projectId); }
  public createProjectCategory(projectId: number, name: string, type: string, options?: any): number { return this.projectRepo.createProjectCategory(projectId, name, type as any, options); }
  public updateProjectCategory(categoryId: number, name: string, type: string, options?: any): void { return this.projectRepo.updateProjectCategory(categoryId, name, type as any, options); }
  public syncProjectCategoryOptions(categoryId: number, options: { id?: number; name: string }[]): void { return this.projectRepo.syncProjectCategoryOptions(categoryId, options); }
  public deleteProjectCategory(categoryId: number): void { return this.projectRepo.deleteProjectCategory(categoryId); }
  public getArticleCategories(articleId: number): ArticleCategory[] { return this.articleRepo.getArticleCategories(articleId); }
  public getAllProjectArticleCategories(projectId: number): ArticleCategory[] { return this.articleRepo.getAllProjectArticleCategories(projectId); }
  public setArticleCategory(articleId: number, categoryId: number, value: string | null): void { return this.articleRepo.setArticleCategory(articleId, categoryId, value); }

  // --- Trash ---
  public getTrashItems(): unknown[] { return this.trashRepo.getTrashItems(); }
  public restoreTrashItem(type: 'project' | 'article' | 'annotation', id: number): void { return this.trashRepo.restoreTrashItem(type, id); }
  public deleteTrashItemPermanent(type: 'project' | 'article' | 'annotation', id: number): void { return this.trashRepo.deleteTrashItemPermanent(type, id); }
  public emptyTrash(): void { return this.trashRepo.emptyTrash(); }

  // --- PDF Library & Sync ---
  public getStoredPdfs(): unknown[] { return this.articleRepo.getStoredPdfs(); }
  public getArticlesForPdf(filePath: string): { id: number; title: string; project_id: number }[] { return this.articleRepo.getArticlesForPdf(filePath); }
  public deletePdfRecord(filePath: string): void { return this.articleRepo.deletePdfRecord(filePath); }
  public deletePdfLibraryRecord(filePath: string): number[] { return this.articleRepo.deletePdfLibraryRecord(filePath); }
  public unlinkPdfFromArticle(articleId: number): void { return this.articleRepo.unlinkPdfFromArticle(articleId); }
  public linkPdfToArticle(articleId: number, filePath: string): void { return this.articleRepo.linkPdfToArticle(articleId, filePath); }
  public registerPdfInLibrary(filePath: string, hash: string, filename: string, size: number): void { return this.articleRepo.registerPdfInLibrary(filePath, hash, filename, size); }
  public importArticlesFromProject(sourceProjectId: number, destProjectId: number, articleIds: number[], searchHistoryId: number): void { return this.articleRepo.importArticlesFromProject(sourceProjectId, destProjectId, articleIds, searchHistoryId); }
  public getPdfByHash(hash: string): any { return this.articleRepo.getPdfByHash(hash); }

  // --- Maintenance ---
  public checkIntegrity(): boolean {
    try {
      const result = this.db.pragma('integrity_check') as Record<string, unknown>[];
      if (!result || result.length === 0) return false;
      const firstRow = result[0];
      const val = firstRow.integrity_check || firstRow['integrity_check'];
      return val === 'ok';
    } catch (e) {
      console.error('Failed to check database integrity:', e);
      return false;
    }
  }

  public checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  public close(): void {
    this.db.close();
  }
}
