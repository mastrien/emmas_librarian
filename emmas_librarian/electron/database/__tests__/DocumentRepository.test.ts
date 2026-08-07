import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { DocumentRepository } from '../DocumentRepository';
import path from 'path';

import fs from 'fs';

describe('DocumentRepository', () => {
  let db: Database.Database;
  let repo: DocumentRepository;
  let actualFs: typeof import('fs');

  beforeEach(async () => {
    db = new Database(':memory:');
    actualFs = fs;
    
    const schema = actualFs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);
    repo = new DocumentRepository(db);

    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(1, 'Test Project');
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  describe('saveProjectDocument', () => {
    it('should save a document with minimal fields', () => {
      const id = repo.saveProjectDocument(1, 'Test Doc');
      expect(id).toBeGreaterThan(0);
      const docs = repo.getProjectDocuments(1);
      expect(docs.length).toBe(1);
      expect(docs[0].title).toBe('Test Doc');
      expect(docs[0].url).toBeNull();
      expect(docs[0].position).toBe(0);
    });

    it('should calculate next position correctly', () => {
      repo.saveProjectDocument(1, 'Doc 1'); // pos 0
      repo.saveProjectDocument(1, 'Doc 2'); // pos 1
      const docs = repo.getProjectDocuments(1);
      expect(docs.find(d => d.title === 'Doc 1')?.position).toBe(0);
      expect(docs.find(d => d.title === 'Doc 2')?.position).toBe(1);
    });

    it('should clean string inputs and convert string projectId to number', () => {
      const id = repo.saveProjectDocument('1' as any, '  Spaced Title  ', '  http://url  ', '  /path/to/file  ', '  cat1  ');
      const docs = repo.getProjectDocuments(1);
      const doc = docs.find(d => d.id === id);
      expect(doc?.title).toBe('Spaced Title');
      expect(doc?.url).toBe('http://url');
      expect(doc?.local_file_path).toBe('/path/to/file');
      expect(doc?.category).toBe('cat1');
    });

    it('should handle undefined or null optional fields', () => {
      const id = repo.saveProjectDocument(1, 'Title', null, null, null);
      const docs = repo.getProjectDocuments(1);
      const doc = docs.find(d => d.id === id);
      expect(doc?.url).toBeNull();
    });

    it('should default empty strings to null for optional fields', () => {
      const id = repo.saveProjectDocument(1, 'Title', '   ', '   ', '   ');
      const docs = repo.getProjectDocuments(1);
      const doc = docs.find(d => d.id === id);
      expect(doc?.url).toBeNull();
      expect(doc?.local_file_path).toBeNull();
      expect(doc?.category).toBeNull();
    });
    
    it('should handle empty or null title safely (though DB requires title)', () => {
      // In JS, if title is passed as null, our cleanTitle logic handles it.
      // But DB schema might fail on null if not string.
      // The implementation uses `title && typeof title === "string" ? title.trim() : ""`
      const id = repo.saveProjectDocument(1, null as any);
      const docs = repo.getProjectDocuments(1);
      const doc = docs.find(d => d.id === id);
      expect(doc?.title).toBe('');
    });
  });

  describe('updateProjectDocument', () => {
    it('should update all fields', () => {
      const id = repo.saveProjectDocument(1, 'Old Title');
      repo.updateProjectDocument(id, 'New Title', 'http://new', '/new/path', 'newCat');
      const docs = repo.getProjectDocuments(1);
      const doc = docs.find(d => d.id === id);
      expect(doc?.title).toBe('New Title');
      expect(doc?.url).toBe('http://new');
      expect(doc?.local_file_path).toBe('/new/path');
      expect(doc?.category).toBe('newCat');
    });

    it('should handle null updates (coalesced to null or empty string)', () => {
      const id = repo.saveProjectDocument(1, 'Title', 'url', 'path', 'cat');
      // @ts-ignore testing undefined/null fallback
      repo.updateProjectDocument(id, null, null, null, null);
      const docs = repo.getProjectDocuments(1);
      const doc = docs.find(d => d.id === id);
      expect(doc?.title).toBe('');
      expect(doc?.url).toBeNull();
      expect(doc?.local_file_path).toBeNull();
      expect(doc?.category).toBeNull();
    });
  });

  describe('reorderProjectDocuments', () => {
    it('should update positions based on array order and handle string projectId', () => {
      const id1 = repo.saveProjectDocument(1, 'Doc 1'); // init pos 0
      const id2 = repo.saveProjectDocument(1, 'Doc 2'); // init pos 1
      const id3 = repo.saveProjectDocument(1, 'Doc 3'); // init pos 2

      repo.reorderProjectDocuments('1' as any, [id3, id1, id2]);
      
      const docs = repo.getProjectDocuments(1);
      expect(docs.find(d => d.id === id3)?.position).toBe(0);
      expect(docs.find(d => d.id === id1)?.position).toBe(1);
      expect(docs.find(d => d.id === id2)?.position).toBe(2);
    });

    it('should filter invalid ids in reorder', () => {
      const id1 = repo.saveProjectDocument(1, 'Doc 1');
      // @ts-ignore
      repo.reorderProjectDocuments(1, [undefined, id1, null, 'invalid']);
      
      const docs = repo.getProjectDocuments(1);
      expect(docs.find(d => d.id === id1)?.position).toBe(0);
    });
    
    it('should do nothing if orderedIds is not an array', () => {
      const id1 = repo.saveProjectDocument(1, 'Doc 1');
      // @ts-ignore
      repo.reorderProjectDocuments(1, "not-an-array");
      
      const docs = repo.getProjectDocuments(1);
      expect(docs.find(d => d.id === id1)?.position).toBe(0);
    });
  });

  describe('deleteProjectDocument', () => {
    it('should delete record from db when no local path', () => {
      const id = repo.saveProjectDocument(1, 'Doc');
      repo.deleteProjectDocument(id);
      const docs = repo.getProjectDocuments(1);
      expect(docs.length).toBe(0);
    });

    it('should delete file if local_file_path exists and is in fs', () => {
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
      const id = repo.saveProjectDocument(1, 'Doc', null, '/path/to/delete.pdf');
      
      repo.deleteProjectDocument(id);
      
      expect(existsSyncSpy).toHaveBeenCalledWith('/path/to/delete.pdf');
      expect(unlinkSyncSpy).toHaveBeenCalledWith('/path/to/delete.pdf');
      
      const docs = repo.getProjectDocuments(1);
      expect(docs.length).toBe(0);
    });

    it('should not throw if file deletion fails', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw new Error('Permission denied'); });
      
      const id = repo.saveProjectDocument(1, 'Doc', null, '/path/to/fail.pdf');
      
      expect(() => repo.deleteProjectDocument(id)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      const docs = repo.getProjectDocuments(1);
      expect(docs.length).toBe(0); // Should still delete from DB
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing with unlink if existsSync returns false', () => {
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
      const id = repo.saveProjectDocument(1, 'Doc', null, '/path/to/delete.pdf');
      
      repo.deleteProjectDocument(id);
      
      expect(existsSyncSpy).toHaveBeenCalledWith('/path/to/delete.pdf');
      expect(unlinkSyncSpy).not.toHaveBeenCalled();
    });
    
    it('should not throw if record id does not exist', () => {
       expect(() => repo.deleteProjectDocument(9999)).not.toThrow();
    });
  });
});
