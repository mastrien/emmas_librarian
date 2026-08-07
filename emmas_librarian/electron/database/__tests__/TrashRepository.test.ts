import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { TrashRepository } from '../TrashRepository';
import { ProjectRepository } from '../ProjectRepository';

describe('TrashRepository', () => {
  let db: Database.Database;
  let repo: TrashRepository;
  let mockProjectRepo: unknown;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);

    mockProjectRepo = {
      deleteProjectPermanent: vi.fn(),
    };

    repo = new TrashRepository(db, mockProjectRepo as ProjectRepository);

    vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (db) db.close();
    vi.restoreAllMocks();
  });

  describe('Trash Operations', () => {
    it('should get trash items from projects, articles, and annotations', () => {
      const pInfo = db.prepare("INSERT INTO projects (name, deleted_at) VALUES ('P1', datetime('now'))").run();
      const pId = pInfo.lastInsertRowid;

      const pActiveInfo = db.prepare("INSERT INTO projects (name) VALUES ('P2')").run();
      const pActiveId = pActiveInfo.lastInsertRowid;

      const aInfo = db.prepare("INSERT INTO articles (project_id, title, deleted_at) VALUES (?, 'A1', datetime('now'))").run(pActiveId);
      const aId = aInfo.lastInsertRowid;

      const annInfo = db.prepare("INSERT INTO annotations (article_id, content_markdown, deleted_at) VALUES (?, 'Ann1', datetime('now'))").run(aId);
      const annId = annInfo.lastInsertRowid;

      const items = repo.getTrashItems() as any[];
      expect(items).toHaveLength(3);
      
      const projectItem = items.find(i => i.type === 'project');
      expect(projectItem.id).toBe(pId);
      expect(projectItem.title).toBe('P1');

      const articleItem = items.find(i => i.type === 'article');
      expect(articleItem.id).toBe(aId);
      expect(articleItem.title).toBe('A1');

      const annItem = items.find(i => i.type === 'annotation');
      expect(annItem.id).toBe(annId);
      expect(annItem.title).toBe('Ann1');
    });

    it('should restore project', () => {
      const pInfo = db.prepare("INSERT INTO projects (name, deleted_at) VALUES ('P1', datetime('now'))").run();
      repo.restoreTrashItem('project', pInfo.lastInsertRowid as number);
      
      const proj = db.prepare('SELECT deleted_at FROM projects WHERE id = ?').get(pInfo.lastInsertRowid) as any;
      expect(proj.deleted_at).toBeNull();
    });

    it('should restore article', () => {
      const pInfo = db.prepare("INSERT INTO projects (name) VALUES ('P1')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title, deleted_at) VALUES (?, 'A1', datetime('now'))").run(pInfo.lastInsertRowid);
      
      repo.restoreTrashItem('article', aInfo.lastInsertRowid as number);
      
      const art = db.prepare('SELECT deleted_at FROM articles WHERE id = ?').get(aInfo.lastInsertRowid) as any;
      expect(art.deleted_at).toBeNull();
    });

    it('should restore annotation', () => {
      const pInfo = db.prepare("INSERT INTO projects (name) VALUES ('P1')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title) VALUES (?, 'A1')").run(pInfo.lastInsertRowid);
      const annInfo = db.prepare("INSERT INTO annotations (article_id, content_markdown, deleted_at) VALUES (?, 'Ann1', datetime('now'))").run(aInfo.lastInsertRowid);
      
      repo.restoreTrashItem('annotation', annInfo.lastInsertRowid as number);
      
      const ann = db.prepare('SELECT deleted_at FROM annotations WHERE id = ?').get(annInfo.lastInsertRowid) as any;
      expect(ann.deleted_at).toBeNull();
    });
    
    it('should delete project permanent', () => {
      repo.deleteTrashItemPermanent('project', 1);
      expect((mockProjectRepo as any).deleteProjectPermanent).toHaveBeenCalledWith(1);
    });

    it('should delete article permanent without physical file', () => {
      const pInfo = db.prepare("INSERT INTO projects (name) VALUES ('P1')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title) VALUES (?, 'A1')").run(pInfo.lastInsertRowid);
      const aId = aInfo.lastInsertRowid as number;
      
      db.prepare("INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'Ann1')").run(aId);
      db.prepare("INSERT INTO highlights (article_id, color, position_data) VALUES (?, 'red', 'pos')").run(aId);

      repo.deleteTrashItemPermanent('article', aId);

      expect(db.prepare('SELECT count(*) as c FROM articles WHERE id = ?').get(aId) as any).toEqual({ c: 0 });
      expect(db.prepare('SELECT count(*) as c FROM annotations WHERE article_id = ?').get(aId) as any).toEqual({ c: 0 });
      expect(db.prepare('SELECT count(*) as c FROM highlights WHERE article_id = ?').get(aId) as any).toEqual({ c: 0 });
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should delete article permanent with physical file', () => {
      const pInfo = db.prepare("INSERT INTO projects (name) VALUES ('P1')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'A1', '/path/to/pdf')").run(pInfo.lastInsertRowid);
      const aId = aInfo.lastInsertRowid as number;

      vi.mocked(fs.existsSync).mockReturnValue(true);

      repo.deleteTrashItemPermanent('article', aId);

      expect(db.prepare('SELECT count(*) as c FROM articles WHERE id = ?').get(aId) as any).toEqual({ c: 0 });
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/pdf');
      expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/pdf');
    });

    it('should catch error when deleting article permanent physical file', () => {
      const pInfo = db.prepare("INSERT INTO projects (name) VALUES ('P1')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'A1', '/path/to/pdf')").run(pInfo.lastInsertRowid);
      const aId = aInfo.lastInsertRowid as number;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error('Delete failed'); });

      repo.deleteTrashItemPermanent('article', aId);
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`Failed to delete physical PDF for article ${aId}:`), expect.any(Error));
      expect(db.prepare('SELECT count(*) as c FROM articles WHERE id = ?').get(aId) as any).toEqual({ c: 0 });
    });
    
    it('should silently ignore non-existent article in deleteTrashItemPermanent', () => {
      repo.deleteTrashItemPermanent('article', 999);
    });

    it('should delete annotation permanent', () => {
      const pInfo = db.prepare("INSERT INTO projects (name) VALUES ('P1')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title) VALUES (?, 'A1')").run(pInfo.lastInsertRowid);
      const annInfo = db.prepare("INSERT INTO annotations (article_id, content_markdown) VALUES (?, 'Ann1')").run(aInfo.lastInsertRowid);
      const annId = annInfo.lastInsertRowid as number;

      repo.deleteTrashItemPermanent('annotation', annId);

      expect(db.prepare('SELECT count(*) as c FROM annotations WHERE id = ?').get(annId) as any).toEqual({ c: 0 });
    });

    it('should empty trash', () => {
      const pInfo = db.prepare("INSERT INTO projects (name, deleted_at) VALUES ('P1', datetime('now'))").run();
      
      const pActiveInfo = db.prepare("INSERT INTO projects (name) VALUES ('P2')").run();
      const aInfo = db.prepare("INSERT INTO articles (project_id, title, deleted_at) VALUES (?, 'A1', datetime('now'))").run(pActiveInfo.lastInsertRowid);
      
      const annInfo = db.prepare("INSERT INTO annotations (article_id, content_markdown, deleted_at) VALUES (?, 'Ann1', datetime('now'))").run(aInfo.lastInsertRowid);

      repo.emptyTrash();

      expect((mockProjectRepo as any).deleteProjectPermanent).toHaveBeenCalledWith(pInfo.lastInsertRowid);
      
      expect(db.prepare('SELECT count(*) as c FROM articles WHERE id = ?').get(aInfo.lastInsertRowid) as any).toEqual({ c: 0 });
      expect(db.prepare('SELECT count(*) as c FROM annotations WHERE id = ?').get(annInfo.lastInsertRowid) as any).toEqual({ c: 0 });
    });
  });
});
