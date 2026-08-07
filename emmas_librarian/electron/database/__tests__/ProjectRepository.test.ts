import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ProjectRepository } from '../ProjectRepository';



describe('ProjectRepository', () => {
  let db: Database.Database;
  let repo: ProjectRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);
    db.exec('ALTER TABLE projects ADD COLUMN writing_pad TEXT;');

    repo = new ProjectRepository(db);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (db) db.close();
  });

  it('should create and get a project', () => {
    const project = repo.createProject('Test Project');
    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.created_at).toBeDefined();

    const fetched = repo.getProject(project.id);
    expect(fetched).toEqual(project);
  });

  it('should return undefined for a non-existent or deleted project', () => {
    expect(repo.getProject(999)).toBeUndefined();
    
    const project = repo.createProject('To Delete');
    repo.deleteProject(project.id);
    expect(repo.getProject(project.id)).toBeUndefined();
  });

  it('should update project writing pad', () => {
    const project = repo.createProject('Pad Project');
    expect(repo.getProjectWritingPad(project.id)).toBeNull();

    repo.updateProjectWritingPad(project.id, 'My Notes');
    expect(repo.getProjectWritingPad(project.id)).toBe('My Notes');
  });

  it('should update project name', () => {
    const project = repo.createProject('Old Name');
    repo.updateProject(project.id, 'New Name');
    
    const fetched = repo.getProject(project.id);
    expect(fetched?.name).toBe('New Name');
  });

  it('should soft delete project', () => {
    const project = repo.createProject('To Soft Delete');
    repo.deleteProject(project.id);
    
    const row = db.prepare('SELECT deleted_at FROM projects WHERE id = ?').get(project.id) as { deleted_at: string };
    expect(row.deleted_at).not.toBeNull();
  });

  it('should permanently delete project and related files', () => {
    const project = repo.createProject('Permanent Delete');
    
    // Insert article with local_file_path
    db.prepare('INSERT INTO articles (project_id, title, local_file_path) VALUES (?, ?, ?)')
      .run(project.id, 'Art1', '/path/to/art1.pdf');
    const articleId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    db.prepare('INSERT INTO highlights (article_id, color, position_data, content_text) VALUES (?, ?, ?, ?)').run(articleId.id, 'red', '{}', 'highlight');
    db.prepare('INSERT INTO annotations (article_id, content_markdown) VALUES (?, ?)').run(articleId.id, 'note');

    // Insert document with local_file_path
    db.prepare('INSERT INTO project_documents (project_id, title, local_file_path) VALUES (?, ?, ?)')
      .run(project.id, 'Doc1', '/path/to/doc1.pdf');

    // Insert other stuff
    db.prepare('INSERT INTO search_history (project_id, unified_query, translated_queries, results_breakdown) VALUES (?, ?, ?, ?)')
      .run(project.id, 'query', '[]', '{}');
    db.prepare('INSERT INTO project_diary (project_id, entry_date, content) VALUES (?, ?, ?)')
      .run(project.id, '2023-01-01', 'diary');
    db.prepare('INSERT INTO project_diary_history (project_id, entry_date, content) VALUES (?, ?, ?)')
      .run(project.id, '2023-01-01', 'diary');

    // Mock fs
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    repo.deleteProjectPermanent(project.id);

    expect(unlinkSpy).toHaveBeenCalledWith('/path/to/art1.pdf');
    expect(unlinkSpy).toHaveBeenCalledWith('/path/to/doc1.pdf');

    expect(db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id)).toBeUndefined();
    expect(db.prepare('SELECT * FROM articles WHERE project_id = ?').all(project.id)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM project_documents WHERE project_id = ?').all(project.id)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM highlights WHERE article_id = ?').all(articleId.id)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM annotations WHERE article_id = ?').all(articleId.id)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM search_history WHERE project_id = ?').all(project.id)).toHaveLength(0);
    expect(db.prepare('SELECT * FROM project_diary WHERE project_id = ?').all(project.id)).toHaveLength(0);
    
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it('should handle fs errors silently during permanent delete', () => {
    const project = repo.createProject('Permanent Delete Error');
    db.prepare('INSERT INTO articles (project_id, title, local_file_path) VALUES (?, ?, ?)')
      .run(project.id, 'Art1', '/path/to/err.pdf');
    db.prepare('INSERT INTO project_documents (project_id, title, local_file_path) VALUES (?, ?, ?)')
      .run(project.id, 'Doc1', '/path/to/doc_err.pdf');

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => repo.deleteProjectPermanent(project.id)).not.toThrow();
    
    expect(consoleError).toHaveBeenCalledTimes(2); // once for article, once for doc

    consoleError.mockRestore();
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it('should get all projects excluding deleted ones', () => {
    repo.createProject('P1');
    const p2 = repo.createProject('P2');
    repo.createProject('P3');

    repo.deleteProject(p2.id);

    const projects = repo.getAllProjects();
    expect(projects).toHaveLength(2);
    const names = projects.map(p => p.name);
    expect(names).toContain('P1');
    expect(names).toContain('P3');
  });

  describe('Project Categories', () => {
    it('should create and retrieve project categories', () => {
      const project = repo.createProject('Cat Project');
      
      const textCatId = repo.createProjectCategory(project.id, 'TextCat', 'text');
      const enumCatId = repo.createProjectCategory(project.id, 'EnumCat', 'enum');
      
      repo.addProjectCategoryOption(enumCatId, 'Opt1');
      repo.addProjectCategoryOption(enumCatId, 'Opt2');

      const categories = repo.getProjectCategories(project.id);
      expect(categories).toHaveLength(2);

      const textCat = categories.find(c => c.name === 'TextCat');
      expect(textCat?.type).toBe('text');
      expect(textCat?.parsedOptions).toBeUndefined();

      const enumCat = categories.find(c => c.name === 'EnumCat');
      expect(enumCat?.type).toBe('enum');
      expect(enumCat?.parsedOptions).toHaveLength(2);
      expect(enumCat?.parsedOptions![0].name).toBe('Opt1');
    });

    it('should delete project category', () => {
      const project = repo.createProject('Cat Project');
      const catId = repo.createProjectCategory(project.id, 'To Delete', 'text');
      
      repo.deleteProjectCategory(catId);
      const categories = repo.getProjectCategories(project.id);
      expect(categories).toHaveLength(0);
    });

    it('should remove project category option', () => {
      const project = repo.createProject('Cat Project');
      const catId = repo.createProjectCategory(project.id, 'Enum', 'enum');
      repo.addProjectCategoryOption(catId, 'Opt1');
      
      const optId = repo.getProjectCategories(project.id)[0].parsedOptions![0].id;
      repo.removeProjectCategoryOption(optId);

      const categories = repo.getProjectCategories(project.id);
      expect(categories[0].parsedOptions).toHaveLength(0);
    });

    it('should update project category (text type)', () => {
      const project = repo.createProject('Proj');
      const catId = repo.createProjectCategory(project.id, 'OldName', 'text');
      
      repo.updateProjectCategory(catId, 'NewName', 'text', 'SomeOptions');
      
      const cat = repo.getProjectCategories(project.id)[0];
      expect(cat.name).toBe('NewName');
      expect(cat.type).toBe('text');
      expect((cat as any).options).toBe('SomeOptions');
    });

    it('should update project category (enum type with array options)', () => {
      const project = repo.createProject('Proj');
      const catId = repo.createProjectCategory(project.id, 'EnumCat', 'enum');
      
      repo.addProjectCategoryOption(catId, 'OptKeep');
      repo.addProjectCategoryOption(catId, 'OptDelete');
      
      const options = repo.getProjectCategories(project.id)[0].parsedOptions!;
      const keepOpt = options.find(o => o.name === 'OptKeep')!;
      
      repo.updateProjectCategory(catId, 'NewEnumName', 'multiselect', [
        { id: keepOpt.id, name: 'OptKeepUpdated' },
        { name: 'OptNew' }
      ] as any);
      
      const updatedCat = repo.getProjectCategories(project.id)[0];
      expect(updatedCat.name).toBe('NewEnumName');
      expect(updatedCat.type).toBe('multiselect');
      
      const opts = updatedCat.parsedOptions!;
      expect(opts).toHaveLength(2);
      expect(opts.find(o => o.id === keepOpt.id)?.name).toBe('OptKeepUpdated');
      expect(opts.find(o => o.name === 'OptNew')).toBeDefined();
    });
  });
});
