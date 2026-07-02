// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';
import * as sqliteVec from 'sqlite-vec';

let mockLoadablePath: string | null = null;

vi.mock('sqlite-vec', async (importOriginal) => {
  const original = await importOriginal<typeof import('sqlite-vec')>();
  return {
    ...original,
    getLoadablePath: () => mockLoadablePath || original.getLoadablePath(),
  };
});

describe('DatabaseAdapter', () => {
  let dbAdapter: DatabaseAdapter;

  beforeEach(() => {
    dbAdapter = new DatabaseAdapter(':memory:');
  });

  afterEach(() => {
    dbAdapter.close();
  });

  it('creates and retrieves a project', () => {
    const proj = dbAdapter.createProject('Test Project');
    expect(proj.id).toBeGreaterThan(0);
    expect(proj.name).toBe('Test Project');

    const retrieved = dbAdapter.getProject(proj.id);
    expect(retrieved).toEqual(proj);

    const all = dbAdapter.getAllProjects();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(proj.id);
  });

  it('saves and retrieves articles', () => {
    const proj = dbAdapter.createProject('Proj1');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Test Article',
      source_query: 'test',
      source_databases: '["OpenAlex"]',
      csl_json: '{}',
    });

    const article = dbAdapter.getArticle(articleId);
    expect(article).toBeDefined();
    expect(article?.title).toBe('Test Article');
    expect(article?.project_id).toBe(proj.id);

    const projectArticles = dbAdapter.getArticlesByProject(proj.id);
    expect(projectArticles).toHaveLength(1);

    dbAdapter.updateArticleFilePath(articleId, '/test/path.pdf');
    const updated = dbAdapter.getArticle(articleId);
    expect(updated?.local_file_path).toBe('/test/path.pdf');
  });

  it('manages annotations and highlights', () => {
    const proj = dbAdapter.createProject('Proj1');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Test',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });

    const annId = dbAdapter.saveAnnotation(articleId, 'Test Annotation');
    const anns = dbAdapter.getAnnotations(articleId);
    expect(anns).toHaveLength(1);
    expect(anns[0].content_markdown).toBe('Test Annotation');

    const hlId = dbAdapter.saveHighlight(articleId, '#ff0', '{}', 'Test Quote', annId);
    const highlights = dbAdapter.getHighlights(articleId);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe('#ff0');
    expect(highlights[0].comment).toBe('Test Annotation'); // from LEFT JOIN
  });

  it('saves search history, associates with articles, and reverts searches correctly', () => {
    const proj = dbAdapter.createProject('Revert Search Project');

    // Save search history
    const searchId = dbAdapter.saveSearchHistory(
      proj.id,
      'test unified query',
      { openalex: 'test translated query' },
      1,
      { openalex: { count: 1 } },
    );
    expect(searchId).toBeGreaterThan(0);

    // Save article with that searchId
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '["openalex"]',
      csl_json: '{}',
      search_id: searchId,
    });

    const article = dbAdapter.getArticle(articleId);
    expect(article?.search_id).toBe(searchId);

    // Revert the search
    dbAdapter.revertSearch(searchId);

    // Verify search is deleted from history
    const history = dbAdapter.getSearchHistory(proj.id);
    expect(history).toHaveLength(0);

    // Verify article is deleted
    const articleDeleted = dbAdapter.getArticle(articleId);
    expect(articleDeleted).toBeUndefined();
  });

  it('manages project documents', () => {
    const proj = dbAdapter.createProject('Doc Project');
    const docId = dbAdapter.saveProjectDocument(proj.id, 'Test Doc', 'https://example.com', '/mock/path.pdf');

    expect(docId).toBeGreaterThan(0);

    const docs = dbAdapter.getProjectDocuments(proj.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('Test Doc');

    dbAdapter.deleteProjectDocument(docId);
    const docsAfterDelete = dbAdapter.getProjectDocuments(proj.id);
    expect(docsAfterDelete).toHaveLength(0);
  });

  it('manages massive investigations', () => {
    const proj = dbAdapter.createProject('Investigate Project');
    const invId = dbAdapter.saveMassiveInvestigation(proj.id, ['What is this?'], [1, 2, 3], 'GPT-4', 'Sucesso');

    expect(invId).toBeGreaterThan(0);

    const investigations = dbAdapter.getMassiveInvestigations(proj.id);
    expect(investigations).toHaveLength(1);
    expect(investigations[0].status).toBe('Sucesso');
    expect(investigations[0].model_used).toBe('GPT-4');
  });

  it('deletes a project and its cascaded records', () => {
    const proj = dbAdapter.createProject('Project to Delete');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article to Delete',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });
    const annId = dbAdapter.saveAnnotation(articleId, 'Test Annotation');
    dbAdapter.saveHighlight(articleId, '#ff0', '{}', 'Test Quote', annId);

    dbAdapter.deleteProject(proj.id);

    expect(dbAdapter.getProject(proj.id)).toBeUndefined();
    expect(dbAdapter.getArticle(articleId)).toBeUndefined();
    expect(dbAdapter.getAnnotations(articleId)).toHaveLength(0);
    expect(dbAdapter.getHighlights(articleId)).toHaveLength(0);
  });

  it('saves, retrieves and updates article citation metadata including volume, pages, url, accessed', () => {
    const proj = dbAdapter.createProject('ProjCitation');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Original Title',
      source_query: 'test',
      source_databases: '["OpenAlex"]',
      csl_json: '{}',
    });

    dbAdapter.updateArticleMetadata(articleId, {
      title: 'Custom Title',
      authors: 'João Silva; Maria Oliveira',
      year: 2022,
      doi: '10.1000/xyz789',
      journal: 'Revista Editada',
      volume: '11',
      issue: '3',
      pages: '146-160',
      url: 'https://example.com/custom-url',
      accessed: '2026-06-04',
    } as unknown);

    const updated = dbAdapter.getArticle(articleId);
    expect(updated).toBeDefined();
    expect(updated.title).toBe('Custom Title');
    expect(updated.authors).toBe('João Silva; Maria Oliveira');
    expect(updated.year).toBe(2022);
    expect(updated.doi).toBe('10.1000/xyz789');
    expect(updated.journal).toBe('Revista Editada');
    expect(updated.volume).toBe('11');
    expect(updated.pages).toBe('146-160');
    expect(updated.url).toBe('https://example.com/custom-url');
    expect(updated.accessed).toBe('2026-06-04');
  });

  it('manages project categories with relational options and legacy fallback', () => {
    const proj = dbAdapter.createProject('Category Project');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'Article for categories',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });

    // 1. Create a category with initial options array
    const catId = dbAdapter.createProjectCategory(proj.id, 'Metodologia', 'enum', [
      { name: 'Qualitativa' },
      { name: 'Quantitativa' },
    ]);
    expect(catId).toBeGreaterThan(0);

    // 2. Retrieve categories and check parsedOptions structure
    let categories = dbAdapter.getProjectCategories(proj.id);
    expect(categories).toHaveLength(1);
    expect(categories[0].parsedOptions).toHaveLength(2);
    expect(categories[0].parsedOptions![0].name).toBe('Qualitativa');
    expect(categories[0].parsedOptions![0].id).toBeGreaterThan(0);
    const qualId = categories[0].parsedOptions![0].id;

    // 3. Set article category using ID string
    dbAdapter.setArticleCategory(articleId, catId, String(qualId));

    // 4. Retrieve article category and ensure it resolves back to the name
    let articleCats = dbAdapter.getAllProjectArticleCategories(proj.id);
    expect(articleCats).toHaveLength(1);
    expect(articleCats[0].value).toBe('Qualitativa');
    expect(articleCats[0].option_ids).toContain(qualId);

    // 5. Update options (rename 'Qualitativa' to 'Qualitativa Modificada' and add 'Mista')
    dbAdapter.updateProjectCategory(catId, 'Metodologia Updated', 'enum', [
      { id: qualId, name: 'Qualitativa Modificada' },
      { name: 'Mista' },
    ]);

    // 6. Verify article still references the modified option correctly
    articleCats = dbAdapter.getAllProjectArticleCategories(proj.id);
    expect(articleCats[0].value).toBe('Qualitativa Modificada');

    // 7. Verify options structure is updated
    categories = dbAdapter.getProjectCategories(proj.id);
    expect(categories[0].name).toBe('Metodologia Updated');
    expect(categories[0].parsedOptions).toHaveLength(2);
    expect(categories[0].parsedOptions?.map((o: unknown) => o.name)).toEqual(['Qualitativa Modificada', 'Mista']);

    // 8. Legacy fallback check: Set using string name instead of ID
    dbAdapter.setArticleCategory(articleId, catId, 'Mista');
    articleCats = dbAdapter.getAllProjectArticleCategories(proj.id);
    expect(articleCats[0].value).toBe('Mista');
    const mistaId = categories[0].parsedOptions?.find((o: unknown) => o.name === 'Mista')?.id;
    expect(articleCats[0].option_ids).toContain(mistaId);
  });

  it('manages diary history version limits (BVA - 0, 1, 9, 10, 11 versions in history)', () => {
    const proj = dbAdapter.createProject('ProjDiaryHistory');
    const entryDate = '2026-06-24';

    // 1st save (0 versions in history, current content is Version 1)
    dbAdapter.saveDiaryEntry(proj.id, entryDate, 'Version 1');
    expect(dbAdapter.getDiaryEntryHistory(proj.id, entryDate)).toHaveLength(0);

    // 2nd save (1 version in history: Version 1, current is Version 2)
    dbAdapter.saveDiaryEntry(proj.id, entryDate, 'Version 2');
    const hist1 = dbAdapter.getDiaryEntryHistory(proj.id, entryDate);
    expect(hist1).toHaveLength(1);
    expect(hist1[0].content).toBe('Version 1');

    // Save up to Version 11 (10 versions in history: Version 10 down to Version 1)
    for (let i = 3; i <= 11; i++) {
      dbAdapter.saveDiaryEntry(proj.id, entryDate, `Version ${i}`);
    }
    const hist10 = dbAdapter.getDiaryEntryHistory(proj.id, entryDate);
    expect(hist10).toHaveLength(10);
    expect(hist10[0].content).toBe('Version 10');
    expect(hist10[9].content).toBe('Version 1');

    // 12th save (should keep exactly 10 versions, deleting Version 1, so oldest in history is Version 2)
    dbAdapter.saveDiaryEntry(proj.id, entryDate, 'Version 12');
    const hist11 = dbAdapter.getDiaryEntryHistory(proj.id, entryDate);
    expect(hist11).toHaveLength(10);
    expect(hist11[0].content).toBe('Version 11');
    expect(hist11[9].content).toBe('Version 2');
  });

  it('handles DOI collision and merges source databases', () => {
    const proj = dbAdapter.createProject('Project DOI Collision');
    const id1 = dbAdapter.saveArticle(proj.id, {
      title: 'Article One',
      doi: '10.1000/xyz123',
      source_query: '',
      source_databases: JSON.stringify(['OpenAlex']),
      csl_json: '{}',
    });

    const id2 = dbAdapter.saveArticle(proj.id, {
      title: 'Article One Different Title',
      doi: '10.1000/xyz123',
      source_query: '',
      source_databases: JSON.stringify(['Scopus']),
      csl_json: '{}',
    });

    expect(id1).toBe(id2);
    const merged = dbAdapter.getArticle(id1);
    expect(merged?.source_databases).toBe(JSON.stringify(['OpenAlex', 'Scopus']));
  });

  it('handles title collision without DOI using normalized title comparison', () => {
    const proj = dbAdapter.createProject('Project Title Collision');
    const id1 = dbAdapter.saveArticle(proj.id, {
      title: '  Complex <i>Title</i>; with punctuation!!  ',
      source_query: '',
      source_databases: JSON.stringify(['OpenAlex']),
      csl_json: '{}',
    });

    const id2 = dbAdapter.saveArticle(proj.id, {
      title: 'complex title with punctuation',
      source_query: '',
      source_databases: JSON.stringify(['Crossref']),
      csl_json: '{}',
    });

    expect(id1).toBe(id2);
    const merged = dbAdapter.getArticle(id1);
    expect(merged?.source_databases).toBe(JSON.stringify(['OpenAlex', 'Crossref']));
  });

  it('handles concurrent insertions gracefully and sequentially due to sync sqlite connection', () => {
    const proj = dbAdapter.createProject('Project Concurrent');
    
    // Simulate concurrent calls by calling saveArticle immediately in sequence
    const ids = [1, 2, 3].map(() => dbAdapter.saveArticle(proj.id, {
      title: 'Concurrent Article',
      doi: '10.1000/concurrent',
      source_query: '',
      source_databases: JSON.stringify(['OpenAlex']),
      csl_json: '{}',
    }));

    expect(ids[0]).toBe(ids[1]);
    expect(ids[1]).toBe(ids[2]);
    expect(dbAdapter.getArticlesByProject(proj.id)).toHaveLength(1);
  });

  it('deletes the physical file when a duplicate PDF is uploaded (updated)', () => {
    const proj = dbAdapter.createProject('Project PDF Duplicate');
    const articleId = dbAdapter.saveArticle(proj.id, {
      title: 'PDF Article',
      source_query: '',
      source_databases: '[]',
      csl_json: '{}',
    });

    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emmas-lib-test-'));
    const file1 = path.join(tempDir, 'file1.pdf');
    const file2 = path.join(tempDir, 'file2.pdf');

    fs.writeFileSync(file1, 'pdf content 1');
    fs.writeFileSync(file2, 'pdf content 2');

    dbAdapter.updateArticleFilePath(articleId, file1);
    expect(fs.existsSync(file1)).toBe(true);

    // Overwrite with file2 - should delete file1
    dbAdapter.updateArticleFilePath(articleId, file2);

    expect(fs.existsSync(file1)).toBe(false);
    expect(fs.existsSync(file2)).toBe(true);

    // Cleanup
    try {
      fs.unlinkSync(file2);
      fs.rmdirSync(tempDir);
    } catch {}
  });

  it('correctly rewrites app.asar to app.asar.unpacked when loading sqlite-vec extension', () => {
    const Database = require('better-sqlite3');
    const loadExtensionSpy = vi.spyOn(Database.prototype, 'loadExtension').mockImplementation(() => {});

    mockLoadablePath = 'C:\\Program Files\\Emma\\resources\\app.asar\\node_modules\\sqlite-vec-windows-x64\\vec0.dll';

    try {
      const adapter = new DatabaseAdapter(':memory:');
      adapter.close();

      expect(loadExtensionSpy).toHaveBeenCalledWith(
        'C:\\Program Files\\Emma\\resources\\app.asar.unpacked\\node_modules\\sqlite-vec-windows-x64\\vec0.dll',
      );
    } finally {
      mockLoadablePath = null;
      loadExtensionSpy.mockRestore();
    }
  });
});
