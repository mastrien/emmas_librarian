import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { HistoryRepository } from '../HistoryRepository';

describe('HistoryRepository', () => {
  let db: Database.Database;
  let repo: HistoryRepository;
  let projectId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);

    db.exec('ALTER TABLE articles ADD COLUMN search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL');

    repo = new HistoryRepository(db);

    const projectInfo = db.prepare("INSERT INTO projects (name) VALUES ('Test Project')").run();
    projectId = projectInfo.lastInsertRowid as number;

    vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (db) db.close();
    vi.restoreAllMocks();
  });

  describe('Search History', () => {
    it('should save and get search history', () => {
      const id = repo.saveSearchHistory(
        projectId,
        'test query',
        { pubmed: 'test' },
        10,
        { pubmed: 10 },
        'date',
        50
      );
      expect(id).toBeGreaterThan(0);

      const history = repo.getSearchHistory(projectId) as any[];
      expect(history).toHaveLength(1);
      expect(history[0].unified_query).toBe('test query');
      expect(JSON.parse(history[0].translated_queries)).toEqual({ pubmed: 'test' });
      expect(history[0].total_results).toBe(10);
      expect(JSON.parse(history[0].results_breakdown)).toEqual({ pubmed: 10 });
      expect(history[0].sort_by).toBe('date');
      expect(history[0].limit_val).toBe(50);
    });

    it('should handle optional sort_by and limitVal', () => {
      repo.saveSearchHistory(projectId, 'test query 2', {}, 0, {});
      const history = repo.getSearchHistory(projectId) as any[];
      expect(history[0].sort_by).toBeNull();
      expect(history[0].limit_val).toBeNull();
    });

    it('should revert search and delete related data', () => {
      const searchId = repo.saveSearchHistory(projectId, 'q', {}, 0, {});

      const articleInfo = db.prepare("INSERT INTO articles (project_id, title, search_id, local_file_path) VALUES (?, 'Title', ?, '/path/to/pdf')").run(projectId, searchId);
      const articleId = articleInfo.lastInsertRowid as number;

      const annotationInfo = db.prepare("INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'content')").run(articleId);
      const annotationId = annotationInfo.lastInsertRowid as number;
      db.prepare("INSERT INTO highlights (article_id, color, position_data) VALUES (?, 'red', 'pos')").run(articleId);

      vi.mocked(fs.existsSync).mockReturnValue(true);

      repo.revertSearch(searchId);

      expect(db.prepare('SELECT count(*) as c FROM search_history WHERE id = ?').get(searchId) as any).toEqual({ c: 0 });
      expect(db.prepare('SELECT count(*) as c FROM articles WHERE id = ?').get(articleId) as any).toEqual({ c: 0 });
      expect(db.prepare('SELECT count(*) as c FROM annotations WHERE id = ?').get(annotationId) as any).toEqual({ c: 0 });
      expect(db.prepare('SELECT count(*) as c FROM highlights WHERE article_id = ?').get(articleId) as any).toEqual({ c: 0 });

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/pdf');
      expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/pdf');
    });
    
    it('should catch error when deleting physical PDF in revertSearch', () => {
      const searchId = repo.saveSearchHistory(projectId, 'q', {}, 0, {});
      db.prepare("INSERT INTO articles (project_id, title, search_id, local_file_path) VALUES (?, 'Title', ?, '/path/to/pdf')").run(projectId, searchId);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error('Delete failed'); });

      repo.revertSearch(searchId);
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to delete physical PDF for article'), expect.any(Error));
    });
    
    it('should not throw if local_file_path is empty in revertSearch', () => {
      const searchId = repo.saveSearchHistory(projectId, 'q', {}, 0, {});
      db.prepare("INSERT INTO articles (project_id, title, search_id) VALUES (?, 'Title', ?)").run(projectId, searchId);

      repo.revertSearch(searchId);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('Diary', () => {
    it('should save and get diary entry', () => {
      repo.saveDiaryEntry(projectId, '2023-01-01', 'Entry content');
      
      const entries = repo.getDiaryEntries(projectId);
      expect(entries).toHaveLength(1);
      expect(entries[0].entry_date).toBe('2023-01-01');
      expect(entries[0].content).toBe('Entry content');

      const entry = repo.getDiaryEntry(projectId, '2023-01-01');
      expect(entry?.content).toBe('Entry content');
    });

    it('should update diary entry and save history', () => {
      repo.saveDiaryEntry(projectId, '2023-01-01', 'Old content');
      repo.saveDiaryEntry(projectId, '2023-01-01', 'New content');

      const entry = repo.getDiaryEntry(projectId, '2023-01-01');
      expect(entry?.content).toBe('New content');

      const history = repo.getDiaryEntryHistory(projectId, '2023-01-01') as any[];
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Old content');
    });

    it('should delete diary entry and save history', () => {
      repo.saveDiaryEntry(projectId, '2023-01-01', 'Content to delete');
      repo.deleteDiaryEntry(projectId, '2023-01-01');

      const entry = repo.getDiaryEntry(projectId, '2023-01-01');
      expect(entry).toBeUndefined();

      const history = repo.getDiaryEntryHistory(projectId, '2023-01-01') as any[];
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Content to delete');
    });
    
    it('should not error when deleting non-existent diary entry', () => {
      repo.deleteDiaryEntry(projectId, '2023-01-02');
      const entry = repo.getDiaryEntry(projectId, '2023-01-02');
      expect(entry).toBeUndefined();
    });

    it('should restore diary entry version', () => {
      repo.saveDiaryEntry(projectId, '2023-01-01', 'Old content');
      repo.saveDiaryEntry(projectId, '2023-01-01', 'New content');

      const history = repo.getDiaryEntryHistory(projectId, '2023-01-01') as any[];
      const versionId = history[0].id;

      repo.restoreDiaryEntryVersion(versionId);

      const entry = repo.getDiaryEntry(projectId, '2023-01-01');
      expect(entry?.content).toBe('Old content');
      
      const newHistory = repo.getDiaryEntryHistory(projectId, '2023-01-01') as any[];
      expect(newHistory).toHaveLength(2);
      expect(newHistory[0].content).toBe('New content');
    });
    
    it('should safely do nothing when restoring non-existent version', () => {
      repo.restoreDiaryEntryVersion(999);
    });
  });
});
