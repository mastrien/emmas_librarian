"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DatabaseManager {
    db;
    constructor(dbPath) {
        this.db = new better_sqlite3_1.default(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.initSchema();
    }
    initSchema() {
        // Determine the right path for schema.sql whether running compiled, in dev, or in tests
        const possiblePaths = [
            path_1.default.join(__dirname, 'schema.sql'), // compiled dist-electron/database/schema.sql or test from __dirname
            path_1.default.join(__dirname, '..', '..', 'electron', 'database', 'schema.sql'), // from dist-electron (if __dirname is dist-electron)
            path_1.default.join(process.cwd(), 'electron', 'database', 'schema.sql'), // test from frontend root
        ];
        let schemaStr = '';
        let found = false;
        for (const p of possiblePaths) {
            if (fs_1.default.existsSync(p)) {
                schemaStr = fs_1.default.readFileSync(p, 'utf-8');
                found = true;
                break;
            }
        }
        if (!found)
            throw new Error("Could not find schema.sql. Checked: " + possiblePaths.join(', '));
        this.db.exec(schemaStr);
        // Migrations — add columns that may not exist in older databases
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
        ];
        for (const sql of migrations) {
            try {
                this.db.exec(sql);
            }
            catch (e) { /* column already exists */ }
        }
    }
    // Projects
    createProject(name) {
        const stmt = this.db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)');
        const info = stmt.run(name, new Date().toISOString());
        return this.getProject(Number(info.lastInsertRowid));
    }
    getProject(id) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
        return stmt.get(id);
    }
    updateProject(id, name) {
        this.db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id);
    }
    deleteProject(id) {
        this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    }
    getAllProjects() {
        const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
        return stmt.all();
    }
    // Articles
    saveArticle(projectId, data) {
        const stmt = this.db.prepare(`
      INSERT INTO articles (project_id, doi, title, authors, year, source_query, source_databases, csl_json,
        abstract, author_keywords, index_keywords, journal, volume, issue, pages, affiliations, references_list, document_type, issn, citation_count)
      VALUES (@project_id, @doi, @title, @authors, @year, @source_query, @source_databases, @csl_json,
        @abstract, @author_keywords, @index_keywords, @journal, @volume, @issue, @pages, @affiliations, @references_list, @document_type, @issn, @citation_count)
    `);
        const info = stmt.run({
            project_id: projectId,
            doi: data.doi || null,
            title: data.title,
            authors: data.authors || null,
            year: data.year || null,
            source_query: data.source_query,
            source_databases: data.source_databases,
            csl_json: data.csl_json,
            abstract: data.abstract || null,
            author_keywords: data.author_keywords || null,
            index_keywords: data.index_keywords || null,
            journal: data.journal || null,
            volume: data.volume || null,
            issue: data.issue || null,
            pages: data.pages || null,
            affiliations: data.affiliations || null,
            references_list: data.references_list || null,
            document_type: data.document_type || null,
            issn: data.issn || null,
            citation_count: data.citation_count || null,
        });
        return info.lastInsertRowid;
    }
    getArticle(id) {
        const stmt = this.db.prepare('SELECT * FROM articles WHERE id = ?');
        return stmt.get(id);
    }
    getArticlesByProject(projectId) {
        const stmt = this.db.prepare('SELECT * FROM articles WHERE project_id = ?');
        return stmt.all(projectId);
    }
    updateArticleFilePath(articleId, path) {
        const stmt = this.db.prepare('UPDATE articles SET local_file_path = ? WHERE id = ?');
        stmt.run(path, articleId);
    }
    updateArticleStatus(articleId, status, archiveNote) {
        const stmt = this.db.prepare('UPDATE articles SET status = ?, archive_note = ? WHERE id = ?');
        stmt.run(status, archiveNote || null, articleId);
    }
    // Annotations
    saveAnnotation(articleId, content) {
        const stmt = this.db.prepare('INSERT INTO annotations (article_id, content_markdown) VALUES (?, ?)');
        const info = stmt.run(articleId, content);
        return info.lastInsertRowid;
    }
    getAnnotations(articleId) {
        const stmt = this.db.prepare('SELECT * FROM annotations WHERE article_id = ? ORDER BY created_at DESC');
        return stmt.all(articleId);
    }
    updateAnnotation(id, content) {
        const stmt = this.db.prepare('UPDATE annotations SET content_markdown = ? WHERE id = ?');
        stmt.run(content, id);
    }
    deleteAnnotation(id) {
        const stmt = this.db.prepare('DELETE FROM annotations WHERE id = ?');
        stmt.run(id);
    }
    // Highlights
    saveHighlight(articleId, color, positionData, annotationId) {
        const stmt = this.db.prepare(`
      INSERT INTO highlights (article_id, color, position_data, annotation_id)
      VALUES (?, ?, ?, ?)
    `);
        const info = stmt.run(articleId, color, positionData, annotationId || null);
        return info.lastInsertRowid;
    }
    getHighlights(articleId) {
        const stmt = this.db.prepare(`
      SELECT h.*, a.content_markdown as comment
      FROM highlights h
      LEFT JOIN annotations a ON h.annotation_id = a.id
      WHERE h.article_id = ?
    `);
        return stmt.all(articleId);
    }
    deleteHighlight(id) {
        // If we want to delete a highlight, we should also delete its associated annotation
        const getStmt = this.db.prepare('SELECT annotation_id FROM highlights WHERE id = ?');
        const highlight = getStmt.get(id);
        const stmt = this.db.prepare('DELETE FROM highlights WHERE id = ?');
        stmt.run(id);
        if (highlight?.annotation_id) {
            this.deleteAnnotation(highlight.annotation_id);
        }
    }
    close() {
        this.db.close();
    }
    // Settings
    getSetting(key) {
        const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : null;
    }
    setSetting(key, value) {
        this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
    // Search History
    saveSearchHistory(projectId, unifiedQuery, translatedQueries, totalResults, breakdown) {
        const stmt = this.db.prepare(`
      INSERT INTO search_history (project_id, unified_query, translated_queries, total_results, results_breakdown, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(projectId, unifiedQuery, JSON.stringify(translatedQueries), totalResults, JSON.stringify(breakdown), new Date().toISOString());
    }
    getSearchHistory(projectId) {
        const stmt = this.db.prepare('SELECT * FROM search_history WHERE project_id = ? ORDER BY created_at DESC');
        return stmt.all(projectId);
    }
    // Diary
    saveDiaryEntry(projectId, entryDate, content) {
        this.db.prepare(`
      INSERT OR REPLACE INTO project_diary (project_id, entry_date, content)
      VALUES (?, ?, ?)
    `).run(projectId, entryDate, content);
    }
    getDiaryEntries(projectId) {
        return this.db.prepare('SELECT * FROM project_diary WHERE project_id = ? ORDER BY entry_date DESC').all(projectId);
    }
    getDiaryEntry(projectId, entryDate) {
        return this.db.prepare('SELECT * FROM project_diary WHERE project_id = ? AND entry_date = ?').get(projectId, entryDate);
    }
    deleteDiaryEntry(projectId, entryDate) {
        this.db.prepare('DELETE FROM project_diary WHERE project_id = ? AND entry_date = ?').run(projectId, entryDate);
    }
}
exports.DatabaseManager = DatabaseManager;
