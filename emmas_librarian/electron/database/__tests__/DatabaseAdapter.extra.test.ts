// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';
import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';

// Mock electron's safeStorage before importing it
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted_', '')),
  },
}));

describe('DatabaseAdapter Settings & Extra', () => {
  let dbAdapter: DatabaseAdapter;

  beforeEach(() => {
    dbAdapter = new DatabaseAdapter(':memory:');
  });

  afterEach(() => {
    dbAdapter.close();
    vi.clearAllMocks();
  });

  it('saves and retrieves unencrypted settings', () => {
    dbAdapter.setSetting('theme', 'dark');
    expect(dbAdapter.getSetting('theme')).toBe('dark');
  });

  it('encrypts and decrypts api_key settings', () => {
    dbAdapter.setSetting('api_key_openai', 'my-secret-key');

    // Direct check in DB to ensure it is stored encrypted (base64 encoded buffer)
    const rawValue = (dbAdapter as unknown).db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('api_key_openai').value;
    expect(rawValue).toBe(Buffer.from('encrypted_my-secret-key').toString('base64'));

    // getSetting should decrypt it back
    const decrypted = dbAdapter.getSetting('api_key_openai');
    expect(decrypted).toBe('my-secret-key');
  });

  it('handles api_key with suffix _api_key', () => {
    dbAdapter.setSetting('custom_service_api_key', 'another-secret');
    const decrypted = dbAdapter.getSetting('custom_service_api_key');
    expect(decrypted).toBe('another-secret');
  });

  it('handles fallback names for scopus and wos API keys', () => {
    // 1. Scopus: save as scopus_api_key, retrieve via api_key_scopus
    dbAdapter.setSetting('scopus_api_key', 'scopus-val-1');
    expect(dbAdapter.getSetting('api_key_scopus')).toBe('scopus-val-1');

    // 2. Scopus: save as api_key_scopus, retrieve via scopus_api_key (if scopus_api_key deleted or not set)
    const db = (dbAdapter as unknown).db;
    db.prepare('DELETE FROM settings WHERE key = ?').run('scopus_api_key');
    dbAdapter.setSetting('api_key_scopus', 'scopus-val-2');
    expect(dbAdapter.getSetting('scopus_api_key')).toBe('scopus-val-2');

    // 3. WoS: save as wos_api_key, retrieve via api_key_wos
    dbAdapter.setSetting('wos_api_key', 'wos-val-1');
    expect(dbAdapter.getSetting('api_key_wos')).toBe('wos-val-1');

    // 4. WoS: save as api_key_wos, retrieve via wos_api_key
    db.prepare('DELETE FROM settings WHERE key = ?').run('wos_api_key');
    dbAdapter.setSetting('api_key_wos', 'wos-val-2');
    expect(dbAdapter.getSetting('wos_api_key')).toBe('wos-val-2');
  });

  it('manages diary entries', () => {
    const proj = dbAdapter.createProject('Diary Project');
    const date = '2023-10-15';

    dbAdapter.saveDiaryEntry(proj.id, date, 'First diary content');
    let entry = dbAdapter.getDiaryEntry(proj.id, date);
    expect(entry?.content).toBe('First diary content');

    const allEntries = dbAdapter.getDiaryEntries(proj.id);
    expect(allEntries).toHaveLength(1);

    dbAdapter.saveDiaryEntry(proj.id, date, 'Updated diary content');
    entry = dbAdapter.getDiaryEntry(proj.id, date);
    expect(entry?.content).toBe('Updated diary content');

    dbAdapter.deleteDiaryEntry(proj.id, date);
    expect(dbAdapter.getDiaryEntry(proj.id, date)).toBeUndefined();
  });

  it('manages project categories and article categories', () => {
    const proj = dbAdapter.createProject('Category Project');
    const categoryId = dbAdapter.createProjectCategory(proj.id, 'Study Type', 'text', 'random-options');
    expect(categoryId).toBeGreaterThan(0);

    let categories = dbAdapter.getProjectCategories(proj.id);
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe('Study Type');

    dbAdapter.updateProjectCategory(categoryId, 'Study Type Updated', 'text', 'new-options');
    categories = dbAdapter.getProjectCategories(proj.id);
    expect(categories[0].name).toBe('Study Type Updated');

    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Cat Article',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });

    dbAdapter.setArticleCategory(articleId, categoryId, 'RCT');
    let artCats = dbAdapter.getArticleCategories(articleId);
    expect(artCats).toHaveLength(1);
    expect(artCats[0].value).toBe('RCT');

    let allProjCats = dbAdapter.getAllProjectArticleCategories(proj.id);
    expect(allProjCats).toHaveLength(1);
    expect(allProjCats[0].value).toBe('RCT');

    // Update
    dbAdapter.setArticleCategory(articleId, categoryId, 'Cohort');
    expect(dbAdapter.getArticleCategories(articleId)[0].value).toBe('Cohort');

    // Delete value
    dbAdapter.setArticleCategory(articleId, categoryId, '');
    expect(dbAdapter.getArticleCategories(articleId)).toHaveLength(0);

    dbAdapter.deleteProjectCategory(categoryId);
    expect(dbAdapter.getProjectCategories(proj.id)).toHaveLength(0);
  });

  it('deletes physical file when deleting project document', () => {
    const tempFile = path.join(__dirname, 'temp_doc_test.pdf');
    fs.writeFileSync(tempFile, 'dummy content');
    expect(fs.existsSync(tempFile)).toBe(true);

    const proj = dbAdapter.createProject('Doc Delete Project');
    const docId = dbAdapter.saveProjectDocument(proj.id, 'Test Doc', 'url', tempFile);

    dbAdapter.deleteProjectDocument(docId);
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  it('deletes physical file when reverting search', () => {
    const tempFile = path.join(__dirname, 'temp_article_test.pdf');
    fs.writeFileSync(tempFile, 'dummy content');
    expect(fs.existsSync(tempFile)).toBe(true);

    const proj = dbAdapter.createProject('Search Revert Physical Project');
    const searchId = dbAdapter.saveSearchHistory(proj.id, 'q', {}, 1, {});
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
      search_id: searchId,
    });
    dbAdapter.updateArticleFilePath(articleId, tempFile);

    dbAdapter.revertSearch(searchId);
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  it('handles pending highlight deletion and decryption error fallback', () => {
    // deletePendingHighlight
    dbAdapter.deletePendingHighlight(999); // shouldn't throw error

    // safeStorage decrypt fallback
    const spy = vi.spyOn(safeStorage, 'decryptString').mockImplementation(() => {
      throw new Error('Decryption failed');
    });

    const db = (dbAdapter as unknown).db;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'api_key_openai',
      'raw-api-key-base64',
    );

    const result = dbAdapter.getSetting('api_key_openai');
    expect(result).toBe('raw-api-key-base64');

    spy.mockRestore();
  });

  it('handles physical file deletion errors in deleteProjectDocument gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('Unlink failed');
    });

    const proj = dbAdapter.createProject('Doc Delete Fail Project');
    const docId = dbAdapter.saveProjectDocument(proj.id, 'Test Doc Fail', 'url', 'fake_file.pdf');

    dbAdapter.deleteProjectDocument(docId);
  });

  it('handles physical file deletion errors in revertSearch gracefully', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('Unlink failed');
    });

    const proj = dbAdapter.createProject('Search Revert Fail Project');
    const searchId = dbAdapter.saveSearchHistory(proj.id, 'q', {}, 1, {});
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
      search_id: searchId,
    });
    dbAdapter.updateArticleFilePath(articleId, 'fake_file.pdf');

    dbAdapter.revertSearch(searchId);
  });

  it('manages pending highlights correctly', () => {
    const proj = dbAdapter.createProject('Pending Highlight Project');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
    });

    const id = dbAdapter.savePendingHighlight(articleId, 'my quote', 'before', 'after', 'my comment');
    expect(id).toBeGreaterThan(0);

    const list = dbAdapter.getPendingHighlights(articleId);
    expect(list).toHaveLength(1);
    expect(list[0].quote).toBe('my quote');

    dbAdapter.deletePendingHighlight(id);
    expect(dbAdapter.getPendingHighlights(articleId)).toHaveLength(0);
  });

  it('manages annotations and highlights editing and deletion', () => {
    const proj = dbAdapter.createProject('Edit Highlight Project');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
    });

    const annId = dbAdapter.saveAnnotation(articleId, 'Initial markdown');
    expect(annId).toBeGreaterThan(0);

    dbAdapter.updateAnnotation(annId, 'Updated markdown');
    expect(dbAdapter.getAnnotations(articleId)[0].content_markdown).toBe('Updated markdown');

    const hlId = dbAdapter.saveHighlight(articleId, 'red', '{}', 'quote text', annId);
    expect(hlId).toBeGreaterThan(0);

    // Delete highlight (should also delete associated annotation)
    dbAdapter.deleteHighlight(hlId);
    expect(dbAdapter.getHighlights(articleId)).toHaveLength(0);
    expect(dbAdapter.getAnnotations(articleId)).toHaveLength(0);

    // Test deleteHighlight without annotation_id
    const hlId2 = dbAdapter.saveHighlight(articleId, 'blue', '{}', 'quote 2');
    dbAdapter.deleteHighlight(hlId2);
    expect(dbAdapter.getHighlights(articleId)).toHaveLength(0);

    // Test deleteAnnotation directly
    const annId2 = dbAdapter.saveAnnotation(articleId, 'standalone annotation');
    dbAdapter.deleteAnnotation(annId2);
    expect(dbAdapter.getAnnotations(articleId)).toHaveLength(0);
  });

  it('updates article status, metadata, and ai summary', () => {
    const proj = dbAdapter.createProject('Update Article Project');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '[]',
      csl_json: '{}',
    });

    dbAdapter.updateArticleStatus(articleId, 'read');
    expect(dbAdapter.getArticle(articleId)?.status).toBe('read');

    dbAdapter.updateArticleMetadata(articleId, {
      title: 'New Title',
      authors: 'Author A, Author B',
      year: 2026,
    });
    const updated = dbAdapter.getArticle(articleId);
    expect(updated?.title).toBe('New Title');
    expect(updated?.authors).toBe('Author A, Author B');
    expect(updated?.year).toBe(2026);

    dbAdapter.updateArticleMetadata(articleId, {});

    dbAdapter.updateArticleAiSummary(articleId, 'Summary Text');
    expect(dbAdapter.getArticle(articleId)?.ai_summary).toBe('Summary Text');
  });

  it('covers physical file deletion and errors when deleting a project', () => {
    const tempFile1 = path.join(__dirname, 'temp_proj_del_art.pdf');
    const tempFile2 = path.join(__dirname, 'temp_proj_del_doc.pdf');
    fs.writeFileSync(tempFile1, 'dummy');
    fs.writeFileSync(tempFile2, 'dummy');

    const proj = dbAdapter.createProject('Project to Delete with Files');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Art',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });
    dbAdapter.updateArticleFilePath(articleId, tempFile1);
    dbAdapter.saveProjectDocument(proj.id, 'Doc', undefined, tempFile2);

    dbAdapter.deleteProjectPermanent(proj.id);
    expect(fs.existsSync(tempFile1)).toBe(false);
    expect(fs.existsSync(tempFile2)).toBe(false);

    const proj2 = dbAdapter.createProject('Project to Delete with Files Fail');
    const articleId2 = dbAdapter.saveArticle(proj2.id, {
      title: 'Art Fail',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });
    dbAdapter.updateArticleFilePath(articleId2, 'fake_file1.pdf');
    dbAdapter.saveProjectDocument(proj2.id, 'Doc Fail', undefined, 'fake_file2.pdf');

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw new Error('Unlink failed');
    });

    dbAdapter.deleteProjectPermanent(proj2.id);
  });

  describe('Trash Bin & Soft Delete', () => {
    it('should soft-delete project, article, and annotation, and hide them from default queries', () => {
      const proj = dbAdapter.createProject('Soft Delete Project');
      const articleId = dbAdapter.saveArticle(proj.id, {
        title: 'Soft Delete Article',
        source_query: '',
        source_databases: '[]',
        csl_json: '{}',
      });
      const annId = dbAdapter.saveAnnotation(articleId, 'Soft Delete Annotation');

      // Verify they are initially retrieved
      expect(dbAdapter.getAllProjects().some((p) => p.id === proj.id)).toBe(true);
      expect(dbAdapter.getArticlesByProject(proj.id).some((a) => a.id === articleId)).toBe(true);
      expect(dbAdapter.getAnnotations(articleId).some((an) => an.id === annId)).toBe(true);

      // Perform soft deletes
      dbAdapter.deleteAnnotation(annId);
      dbAdapter.deleteArticle(articleId);
      dbAdapter.deleteProject(proj.id);

      // Verify they are filtered out in default queries
      expect(dbAdapter.getAllProjects().some((p) => p.id === proj.id)).toBe(false);
      expect(dbAdapter.getArticlesByProject(proj.id).some((a) => a.id === articleId)).toBe(false);
      expect(dbAdapter.getAnnotations(articleId).some((an) => an.id === annId)).toBe(false);

      // Verify getProject and getArticle also filter out deleted items
      expect(dbAdapter.getProject(proj.id)).toBeUndefined();
      expect(dbAdapter.getArticle(articleId)).toBeUndefined();
    });

    it('should list soft-deleted items in the trash bin', () => {
      const proj = dbAdapter.createProject('Trash Bin Project');
      const articleId = dbAdapter.saveArticle(proj.id, {
        title: 'Trash Bin Article',
        source_query: '',
        source_databases: '[]',
        csl_json: '{}',
      });
      const annId = dbAdapter.saveAnnotation(articleId, 'Trash Bin Annotation');

      dbAdapter.deleteAnnotation(annId);
      dbAdapter.deleteArticle(articleId);
      dbAdapter.deleteProject(proj.id);

      const trash = dbAdapter.getTrashItems();
      expect(trash).toBeDefined();

      const deletedProj = trash.find((t: unknown) => t.type === 'project' && t.id === proj.id);
      const deletedArt = trash.find((t: unknown) => t.type === 'article' && t.id === articleId);
      const deletedAnn = trash.find((t: unknown) => t.type === 'annotation' && t.id === annId);

      expect(deletedProj).toBeDefined();
      expect(deletedProj.title).toBe('Trash Bin Project');
      expect(deletedArt).toBeDefined();
      expect(deletedArt.title).toBe('Trash Bin Article');
      expect(deletedAnn).toBeDefined();
      expect(deletedAnn.title).toBe('Trash Bin Annotation');
    });

    it('should restore soft-deleted items from the trash bin', () => {
      const proj = dbAdapter.createProject('Restore Project');
      dbAdapter.deleteProject(proj.id);
      expect(dbAdapter.getProject(proj.id)).toBeUndefined();

      dbAdapter.restoreTrashItem('project', proj.id);
      expect(dbAdapter.getProject(proj.id)).toBeDefined();
      expect(dbAdapter.getProject(proj.id)?.name).toBe('Restore Project');
    });

    it('should permanently delete items from the trash bin', () => {
      const proj = dbAdapter.createProject('Permanent Project');
      dbAdapter.deleteProject(proj.id);

      dbAdapter.deleteTrashItemPermanent('project', proj.id);

      // Attempting to restore or fetch after permanent delete should fail/be null
      const trash = dbAdapter.getTrashItems();
      expect(trash.some((t: unknown) => t.type === 'project' && t.id === proj.id)).toBe(false);
    });

    it('should empty the trash bin permanently', () => {
      const proj = dbAdapter.createProject('Empty Project');
      dbAdapter.deleteProject(proj.id);

      dbAdapter.emptyTrash();
      expect(dbAdapter.getTrashItems()).toHaveLength(0);
    });
  });

  describe('Diary Versioning', () => {
    it('should record diary history and keep only latest 10 versions', () => {
      const proj = dbAdapter.createProject('Diary Hist Project');
      const date = '2026-06-05';

      // First save
      dbAdapter.saveDiaryEntry(proj.id, date, 'Version 1');
      expect(dbAdapter.getDiaryEntryHistory(proj.id, date)).toHaveLength(0);

      // Second save (should backup Version 1)
      dbAdapter.saveDiaryEntry(proj.id, date, 'Version 2');
      let history = dbAdapter.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Version 1');

      // Do 11 more saves (total 13 versions, so 12 history entries)
      for (let i = 3; i <= 13; i++) {
        dbAdapter.saveDiaryEntry(proj.id, date, `Version ${i}`);
      }

      // History should be capped at 10 versions
      history = dbAdapter.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(10);
      // Newest first
      expect(history[0].content).toBe('Version 12');
      expect(history[9].content).toBe('Version 3');
    });

    it('should record history on delete diary entry', () => {
      const proj = dbAdapter.createProject('Diary Del Project');
      const date = '2026-06-05';

      dbAdapter.saveDiaryEntry(proj.id, date, 'To delete content');
      dbAdapter.deleteDiaryEntry(proj.id, date);

      // Verify entry is deleted from active project_diary
      expect(dbAdapter.getDiaryEntry(proj.id, date)).toBeUndefined();

      // Verify the deleted content was sent to history
      const history = dbAdapter.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('To delete content');
    });

    it('should restore a specific diary entry version from history', () => {
      const proj = dbAdapter.createProject('Diary Restore Project');
      const date = '2026-06-05';

      dbAdapter.saveDiaryEntry(proj.id, date, 'Old Content');
      dbAdapter.saveDiaryEntry(proj.id, date, 'New Content');

      const history = dbAdapter.getDiaryEntryHistory(proj.id, date);
      expect(history).toHaveLength(1);
      const oldVersionId = history[0].id;

      dbAdapter.restoreDiaryEntryVersion(oldVersionId);
      expect(dbAdapter.getDiaryEntry(proj.id, date)?.content).toBe('Old Content');
    });
  });
});
