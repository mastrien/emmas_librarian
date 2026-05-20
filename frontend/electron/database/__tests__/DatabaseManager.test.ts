import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
  });

  afterEach(() => {
    dbManager.close();
  });

  it('creates and retrieves a project', () => {
    const proj = dbManager.createProject('Test Project');
    expect(proj.id).toBeGreaterThan(0);
    expect(proj.name).toBe('Test Project');

    const retrieved = dbManager.getProject(proj.id);
    expect(retrieved).toEqual(proj);

    const all = dbManager.getAllProjects();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(proj.id);
  });

  it('saves and retrieves articles', () => {
    const proj = dbManager.createProject('Proj1');
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Test Article',
      source_query: 'test',
      source_databases: '["OpenAlex"]',
      csl_json: '{}'
    });

    const article = dbManager.getArticle(articleId);
    expect(article).toBeDefined();
    expect(article?.title).toBe('Test Article');
    expect(article?.project_id).toBe(proj.id);

    const projectArticles = dbManager.getArticlesByProject(proj.id);
    expect(projectArticles).toHaveLength(1);
    
    dbManager.updateArticleFilePath(articleId, '/test/path.pdf');
    const updated = dbManager.getArticle(articleId);
    expect(updated?.local_file_path).toBe('/test/path.pdf');
  });

  it('manages annotations and highlights', () => {
    const proj = dbManager.createProject('Proj1');
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Test', source_query: '', source_databases: '[]', csl_json: '{}'
    });

    const annId = dbManager.saveAnnotation(articleId, 'Test Annotation');
    const anns = dbManager.getAnnotations(articleId);
    expect(anns).toHaveLength(1);
    expect(anns[0].content_markdown).toBe('Test Annotation');

    const hlId = dbManager.saveHighlight(articleId, '#ff0', '{}', annId);
    const highlights = dbManager.getHighlights(articleId);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe('#ff0');
    expect(highlights[0].comment).toBe('Test Annotation'); // from LEFT JOIN
  });

  it('saves search history, associates with articles, and reverts searches correctly', () => {
    const proj = dbManager.createProject('Revert Search Project');
    
    // Save search history
    const searchId = dbManager.saveSearchHistory(
      proj.id,
      'test unified query',
      { openalex: 'test translated query' },
      1,
      { openalex: { count: 1 } }
    );
    expect(searchId).toBeGreaterThan(0);

    // Save article with that searchId
    const articleId = dbManager.saveArticle(proj.id, {
      title: 'Article 1',
      source_query: 'test',
      source_databases: '["openalex"]',
      csl_json: '{}',
      search_id: searchId
    });

    const article = dbManager.getArticle(articleId);
    expect(article?.search_id).toBe(searchId);

    // Revert the search
    dbManager.revertSearch(searchId);

    // Verify search is deleted from history
    const history = dbManager.getSearchHistory(proj.id);
    expect(history).toHaveLength(0);

    // Verify article is deleted
    const articleDeleted = dbManager.getArticle(articleId);
    expect(articleDeleted).toBeUndefined();
  });
});
