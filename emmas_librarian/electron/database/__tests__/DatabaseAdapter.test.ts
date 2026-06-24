// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';

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

    const updated = dbAdapter.getArticle(articleId) as unknown;
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
});
