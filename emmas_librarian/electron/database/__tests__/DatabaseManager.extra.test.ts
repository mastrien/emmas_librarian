import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';
import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';

// Mock electron's safeStorage before importing it
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted_', ''))
  }
}));

describe('DatabaseManager Settings & Extra', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
  });

  afterEach(() => {
    dbManager.close();
    vi.clearAllMocks();
  });

  it('saves and retrieves unencrypted settings', () => {
    dbManager.setSetting('theme', 'dark');
    expect(dbManager.getSetting('theme')).toBe('dark');
  });

  it('encrypts and decrypts api_key settings', () => {
    dbManager.setSetting('api_key_openai', 'my-secret-key');
    
    // Direct check in DB to ensure it is stored encrypted (base64 encoded buffer)
    const rawValue = (dbManager as any).db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key_openai').value;
    expect(rawValue).toBe(Buffer.from('encrypted_my-secret-key').toString('base64'));

    // getSetting should decrypt it back
    const decrypted = dbManager.getSetting('api_key_openai');
    expect(decrypted).toBe('my-secret-key');
  });

  it('handles api_key with suffix _api_key', () => {
    dbManager.setSetting('custom_service_api_key', 'another-secret');
    const decrypted = dbManager.getSetting('custom_service_api_key');
    expect(decrypted).toBe('another-secret');
  });

  it('handles fallback names for scopus and wos API keys', () => {
    // 1. Scopus: save as scopus_api_key, retrieve via api_key_scopus
    dbManager.setSetting('scopus_api_key', 'scopus-val-1');
    expect(dbManager.getSetting('api_key_scopus')).toBe('scopus-val-1');

    // 2. Scopus: save as api_key_scopus, retrieve via scopus_api_key (if scopus_api_key deleted or not set)
    const db = (dbManager as any).db;
    db.prepare('DELETE FROM settings WHERE key = ?').run('scopus_api_key');
    dbManager.setSetting('api_key_scopus', 'scopus-val-2');
    expect(dbManager.getSetting('scopus_api_key')).toBe('scopus-val-2');

    // 3. WoS: save as wos_api_key, retrieve via api_key_wos
    dbManager.setSetting('wos_api_key', 'wos-val-1');
    expect(dbManager.getSetting('api_key_wos')).toBe('wos-val-1');

    // 4. WoS: save as api_key_wos, retrieve via wos_api_key
    db.prepare('DELETE FROM settings WHERE key = ?').run('wos_api_key');
    dbManager.setSetting('api_key_wos', 'wos-val-2');
    expect(dbManager.getSetting('wos_api_key')).toBe('wos-val-2');
  });

  it('manages diary entries', () => {
    const proj = dbManager.createProject('Diary Project');
    const date = '2023-10-15';
    
    dbManager.saveDiaryEntry(proj.id, date, 'First diary content');
    let entry = dbManager.getDiaryEntry(proj.id, date);
    expect(entry?.content).toBe('First diary content');

    const allEntries = dbManager.getDiaryEntries(proj.id);
    expect(allEntries).toHaveLength(1);

    dbManager.saveDiaryEntry(proj.id, date, 'Updated diary content');
    entry = dbManager.getDiaryEntry(proj.id, date);
    expect(entry?.content).toBe('Updated diary content');

    dbManager.deleteDiaryEntry(proj.id, date);
    expect(dbManager.getDiaryEntry(proj.id, date)).toBeUndefined();
  });

  it('manages project categories and article categories', () => {
    const proj = dbManager.createProject('Category Project');
    const categoryId = dbManager.createProjectCategory(proj.id, 'Study Type', 'text', 'random-options');
    expect(categoryId).toBeGreaterThan(0);

    let categories = dbManager.getProjectCategories(proj.id);
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('Study Type');

    dbManager.updateProjectCategory(categoryId, 'Study Type Updated', 'text', 'new-options');
    categories = dbManager.getProjectCategories(proj.id);
    expect(categories[0].name).toBe('Study Type Updated');

    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Cat Article', source_query: '', source_databases: '[]', csl_json: '{}'
    });

    dbManager.setArticleCategory(articleId, categoryId, 'RCT');
    let artCats = dbManager.getArticleCategories(articleId);
    expect(artCats).toHaveLength(1);
    expect(artCats[0].value).toBe('RCT');

    let allProjCats = dbManager.getAllProjectArticleCategories(proj.id);
    expect(allProjCats).toHaveLength(1);
    expect(allProjCats[0].value).toBe('RCT');

    // Update
    dbManager.setArticleCategory(articleId, categoryId, 'Cohort');
    expect(dbManager.getArticleCategories(articleId)[0].value).toBe('Cohort');

    // Delete value
    dbManager.setArticleCategory(articleId, categoryId, '');
    expect(dbManager.getArticleCategories(articleId)).toHaveLength(0);

    dbManager.deleteProjectCategory(categoryId);
    expect(dbManager.getProjectCategories(proj.id)).toHaveLength(0);
  });

  it('deletes physical file when deleting project document', () => {
    const tempFile = path.join(__dirname, 'temp_doc_test.pdf');
    fs.writeFileSync(tempFile, 'dummy content');
    expect(fs.existsSync(tempFile)).toBe(true);

    const proj = dbManager.createProject('Doc Delete Project');
    const docId = dbManager.saveProjectDocument(proj.id, 'Test Doc', 'url', tempFile);

    dbManager.deleteProjectDocument(docId);
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  it('deletes physical file when reverting search', () => {
    const tempFile = path.join(__dirname, 'temp_article_test.pdf');
    fs.writeFileSync(tempFile, 'dummy content');
    expect(fs.existsSync(tempFile)).toBe(true);

    const proj = dbManager.createProject('Search Revert Physical Project');
    const searchId = dbManager.saveSearchHistory(proj.id, 'q', {}, 1, {});
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
      search_id: searchId
    });
    dbManager.updateArticleFilePath(articleId, tempFile);

    dbManager.revertSearch(searchId);
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  it('handles pending highlight deletion and decryption error fallback', () => {
    // deletePendingHighlight
    dbManager.deletePendingHighlight(999); // shouldn't throw error

    // safeStorage decrypt fallback
    const spy = vi.spyOn(safeStorage, 'decryptString').mockImplementation(() => {
      throw new Error('Decryption failed');
    });

    const db = (dbManager as any).db;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('api_key_openai', 'raw-api-key-base64');

    const result = dbManager.getSetting('api_key_openai');
    expect(result).toBe('raw-api-key-base64');

    spy.mockRestore();
  });

  it('handles physical file deletion errors in deleteProjectDocument gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('Unlink failed');
    });

    const proj = dbManager.createProject('Doc Delete Fail Project');
    const docId = dbManager.saveProjectDocument(proj.id, 'Test Doc Fail', 'url', 'fake_file.pdf');

    dbManager.deleteProjectDocument(docId);
  });

  it('handles physical file deletion errors in revertSearch gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('Unlink failed');
    });

    const proj = dbManager.createProject('Search Revert Fail Project');
    const searchId = dbManager.saveSearchHistory(proj.id, 'q', {}, 1, {});
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
      search_id: searchId
    });
    dbManager.updateArticleFilePath(articleId, 'fake_file.pdf');

    dbManager.revertSearch(searchId);
  });

  it('manages pending highlights correctly', () => {
    const proj = dbManager.createProject('Pending Highlight Project');
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Article 1', source_query: 'test', source_databases: '[]', csl_json: '{}'
    });

    const id = dbManager.savePendingHighlight(articleId, 'my quote', 'before', 'after', 'my comment');
    expect(id).toBeGreaterThan(0);

    const list = dbManager.getPendingHighlights(articleId);
    expect(list).toHaveLength(1);
    expect(list[0].quote).toBe('my quote');

    dbManager.deletePendingHighlight(id);
    expect(dbManager.getPendingHighlights(articleId)).toHaveLength(0);
  });

  it('manages annotations and highlights editing and deletion', () => {
    const proj = dbManager.createProject('Edit Highlight Project');
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Article 1', source_query: 'test', source_databases: '[]', csl_json: '{}'
    });

    const annId = dbManager.saveAnnotation(articleId, 'Initial markdown');
    expect(annId).toBeGreaterThan(0);

    dbManager.updateAnnotation(annId, 'Updated markdown');
    expect(dbManager.getAnnotations(articleId)[0].content_markdown).toBe('Updated markdown');

    const hlId = dbManager.saveHighlight(articleId, 'red', '{}', 'quote text', annId);
    expect(hlId).toBeGreaterThan(0);

    // Delete highlight (should also delete associated annotation)
    dbManager.deleteHighlight(hlId);
    expect(dbManager.getHighlights(articleId)).toHaveLength(0);
    expect(dbManager.getAnnotations(articleId)).toHaveLength(0);

    // Test deleteHighlight without annotation_id
    const hlId2 = dbManager.saveHighlight(articleId, 'blue', '{}', 'quote 2');
    dbManager.deleteHighlight(hlId2);
    expect(dbManager.getHighlights(articleId)).toHaveLength(0);

    // Test deleteAnnotation directly
    const annId2 = dbManager.saveAnnotation(articleId, 'standalone annotation');
    dbManager.deleteAnnotation(annId2);
    expect(dbManager.getAnnotations(articleId)).toHaveLength(0);
  });

  it('updates article status, metadata, and ai summary', () => {
    const proj = dbManager.createProject('Update Article Project');
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Article 1', source_query: 'test', source_databases: '[]', csl_json: '{}'
    });

    dbManager.updateArticleStatus(articleId, 'read');
    expect(dbManager.getArticle(articleId)?.status).toBe('read');

    dbManager.updateArticleMetadata(articleId, {
      title: 'New Title',
      authors: 'Author A, Author B',
      year: 2026
    });
    const updated = dbManager.getArticle(articleId);
    expect(updated?.title).toBe('New Title');
    expect(updated?.authors).toBe('Author A, Author B');
    expect(updated?.year).toBe(2026);

    dbManager.updateArticleMetadata(articleId, {});

    dbManager.updateArticleAiSummary(articleId, 'Summary Text');
    expect(dbManager.getArticle(articleId)?.ai_summary).toBe('Summary Text');
  });

  it('covers physical file deletion and errors when deleting a project', () => {
    const tempFile1 = path.join(__dirname, 'temp_proj_del_art.pdf');
    const tempFile2 = path.join(__dirname, 'temp_proj_del_doc.pdf');
    fs.writeFileSync(tempFile1, 'dummy');
    fs.writeFileSync(tempFile2, 'dummy');

    const proj = dbManager.createProject('Project to Delete with Files');
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Art', source_query: '', source_databases: '[]', csl_json: '{}'
    });
    dbManager.updateArticleFilePath(articleId, tempFile1);
    dbManager.saveProjectDocument(proj.id, 'Doc', undefined, tempFile2);

    dbManager.deleteProjectPermanent(proj.id);
    expect(fs.existsSync(tempFile1)).toBe(false);
    expect(fs.existsSync(tempFile2)).toBe(false);

    const proj2 = dbManager.createProject('Project to Delete with Files Fail');
    const articleId2 = dbManager.saveArticle(proj2.id, {
      title: 'Art Fail', source_query: '', source_databases: '[]', csl_json: '{}'
    });
    dbManager.updateArticleFilePath(articleId2, 'fake_file1.pdf');
    dbManager.saveProjectDocument(proj2.id, 'Doc Fail', undefined, 'fake_file2.pdf');

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw new Error('Unlink failed');
    });

    dbManager.deleteProjectPermanent(proj2.id);
  });

  describe('Trash Bin & Soft Delete', () => {
    it('should soft-delete project, article, and annotation, and hide them from default queries', () => {
      const proj = dbManager.createProject('Soft Delete Project');
      const articleId = dbManager.saveArticle(proj.id, {
        title: 'Soft Delete Article', source_query: '', source_databases: '[]', csl_json: '{}'
      });
      const annId = dbManager.saveAnnotation(articleId, 'Soft Delete Annotation');

      // Verify they are initially retrieved
      expect(dbManager.getAllProjects().some(p => p.id === proj.id)).toBe(true);
      expect(dbManager.getArticlesByProject(proj.id).some(a => a.id === articleId)).toBe(true);
      expect(dbManager.getAnnotations(articleId).some(an => an.id === annId)).toBe(true);

      // Perform soft deletes
      dbManager.deleteAnnotation(annId);
      dbManager.deleteArticle(articleId);
      dbManager.deleteProject(proj.id);

      // Verify they are filtered out in default queries
      expect(dbManager.getAllProjects().some(p => p.id === proj.id)).toBe(false);
      expect(dbManager.getArticlesByProject(proj.id).some(a => a.id === articleId)).toBe(false);
      expect(dbManager.getAnnotations(articleId).some(an => an.id === annId)).toBe(false);

      // Verify getProject and getArticle also filter out deleted items
      expect(dbManager.getProject(proj.id)).toBeUndefined();
      expect(dbManager.getArticle(articleId)).toBeUndefined();
    });

    it('should list soft-deleted items in the trash bin', () => {
      const proj = dbManager.createProject('Trash Bin Project');
      const articleId = dbManager.saveArticle(proj.id, {
        title: 'Trash Bin Article', source_query: '', source_databases: '[]', csl_json: '{}'
      });
      const annId = dbManager.saveAnnotation(articleId, 'Trash Bin Annotation');

      dbManager.deleteAnnotation(annId);
      dbManager.deleteArticle(articleId);
      dbManager.deleteProject(proj.id);

      const trash = dbManager.getTrashItems();
      expect(trash).toBeDefined();
      
      const deletedProj = trash.find((t: any) => t.type === 'project' && t.id === proj.id);
      const deletedArt = trash.find((t: any) => t.type === 'article' && t.id === articleId);
      const deletedAnn = trash.find((t: any) => t.type === 'annotation' && t.id === annId);

      expect(deletedProj).toBeDefined();
      expect(deletedProj.title).toBe('Trash Bin Project');
      expect(deletedArt).toBeDefined();
      expect(deletedArt.title).toBe('Trash Bin Article');
      expect(deletedAnn).toBeDefined();
      expect(deletedAnn.title).toBe('Trash Bin Annotation');
    });

    it('should restore soft-deleted items from the trash bin', () => {
      const proj = dbManager.createProject('Restore Project');
      dbManager.deleteProject(proj.id);
      expect(dbManager.getProject(proj.id)).toBeUndefined();

      dbManager.restoreTrashItem('project', proj.id);
      expect(dbManager.getProject(proj.id)).toBeDefined();
      expect(dbManager.getProject(proj.id)?.name).toBe('Restore Project');
    });

    it('should permanently delete items from the trash bin', () => {
      const proj = dbManager.createProject('Permanent Project');
      dbManager.deleteProject(proj.id);

      dbManager.deleteTrashItemPermanent('project', proj.id);
      
      // Attempting to restore or fetch after permanent delete should fail/be null
      const trash = dbManager.getTrashItems();
      expect(trash.some((t: any) => t.type === 'project' && t.id === proj.id)).toBe(false);
    });

    it('should empty the trash bin permanently', () => {
      const proj = dbManager.createProject('Empty Project');
      dbManager.deleteProject(proj.id);

      dbManager.emptyTrash();
      expect(dbManager.getTrashItems()).toHaveLength(0);
    });
  });

  describe('Diary Versioning', () => {
    it('should record diary history and keep only latest 10 versions', () => {
      const proj = dbManager.createProject('Diary Hist Project');
      const date = '2026-06-05';

      // First save
      dbManager.saveDiaryEntry(proj.id, date, 'Version 1');
      expect(dbManager.getDiaryEntryHistory(proj.id, date)).toHaveLength(0);

      // Second save (should backup Version 1)
      dbManager.saveDiaryEntry(proj.id, date, 'Version 2');
      let history = dbManager.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Version 1');

      // Do 11 more saves (total 13 versions, so 12 history entries)
      for (let i = 3; i <= 13; i++) {
        dbManager.saveDiaryEntry(proj.id, date, `Version ${i}`);
      }

      // History should be capped at 10 versions
      history = dbManager.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(10);
      // Newest first
      expect(history[0].content).toBe('Version 12');
      expect(history[9].content).toBe('Version 3');
    });

    it('should record history on delete diary entry', () => {
      const proj = dbManager.createProject('Diary Del Project');
      const date = '2026-06-05';

      dbManager.saveDiaryEntry(proj.id, date, 'To delete content');
      dbManager.deleteDiaryEntry(proj.id, date);

      // Verify entry is deleted from active project_diary
      expect(dbManager.getDiaryEntry(proj.id, date)).toBeUndefined();

      // Verify the deleted content was sent to history
      const history = dbManager.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('To delete content');
    });

    it('should restore a specific diary entry version from history', () => {
      const proj = dbManager.createProject('Diary Restore Project');
      const date = '2026-06-05';

      dbManager.saveDiaryEntry(proj.id, date, 'Old Content');
      dbManager.saveDiaryEntry(proj.id, date, 'New Content');

      const history = dbManager.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(1);
      const oldVersionId = history[0].id;

      dbManager.restoreDiaryEntryVersion(oldVersionId);
      expect(dbManager.getDiaryEntry(proj.id, date)?.content).toBe('Old Content');
    });
  });
});

