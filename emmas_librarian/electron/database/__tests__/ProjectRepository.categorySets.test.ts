// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectRepository } from '../ProjectRepository';
import { CATEGORY_TEMPLATES, categorySetJson, parseCategorySet } from '../../../src/utils/categoryTemplates';

const template = (id: string) => CATEGORY_TEMPLATES.find((t) => t.id === id)!.categories;

describe('ProjectRepository.applyCategorySet (#46), against real SQLite', () => {
  let db: Database.Database;
  let repo: ProjectRepository;
  let projectId: number;

  const summary = (id = projectId) =>
    repo.getProjectCategories(id).map((c) => [c.name, c.type, c.parsedOptions?.map((o) => o.name)]);

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8'));
    repo = new ProjectRepository(db);
    projectId = repo.createProject('Tese').id;
  });

  afterEach(() => db.close());

  it('creates every category and option of a template, in the template’s order', () => {
    const result = repo.applyCategorySet(projectId, template('study-characteristics'));

    const expected = template('study-characteristics').map((c) => [c.name, c.type, c.options]);
    expect(summary()).toEqual(expected);
    expect(result).toEqual({ created: expected.map(([name]) => name), skipped: [] });
  });

  it('only adds to a project that already has categories: nothing deleted, same names kept as they were', () => {
    const existing = repo.createProjectCategory(projectId, 'população', 'text');
    db.prepare('INSERT INTO article_categories (article_id, category_id, value) VALUES (?, ?, ?)').run(
      1,
      existing,
      'x',
    );

    const result = repo.applyCategorySet(projectId, template('pico'));

    expect(result).toEqual({ created: ['Intervenção', 'Comparação', 'Desfecho'], skipped: ['População'] });
    expect(summary().map(([name]) => name)).toEqual(['população', 'Intervenção', 'Comparação', 'Desfecho']);
    expect(db.prepare('SELECT value FROM article_categories WHERE category_id = ?').get(existing)).toEqual({
      value: 'x',
    });
  });

  it('adds nothing when one category fails halfway (all or nothing)', () => {
    db.exec(
      "CREATE TRIGGER refuse BEFORE INSERT ON project_categories WHEN NEW.name = 'Desfecho' BEGIN SELECT RAISE(ABORT, 'refused'); END;",
    );

    expect(() => repo.applyCategorySet(projectId, template('pico'))).toThrowError(/refused/);
    expect(summary()).toEqual([]);
  });

  it('copies a project’s categories to another through a JSON file on disk', () => {
    repo.applyCategorySet(projectId, template('methodological-quality'));
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'category-set-'));
    try {
      const file = path.join(folder, 'categorias.json');
      fs.writeFileSync(file, categorySetJson(repo.getProjectCategories(projectId)));
      const otherProject = repo.createProject('Outro').id;

      repo.applyCategorySet(otherProject, parseCategorySet(fs.readFileSync(file, 'utf-8')));

      expect(summary(otherProject)).toEqual(summary());
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});
