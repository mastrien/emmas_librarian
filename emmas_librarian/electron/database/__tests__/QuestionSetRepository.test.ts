import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { QuestionSetRepository } from '../QuestionSetRepository';

describe('QuestionSetRepository', () => {
  let dbAdapter: DatabaseAdapter;
  let repo: QuestionSetRepository;

  beforeEach(() => {
    dbAdapter = new DatabaseAdapter(':memory:');
    repo = new QuestionSetRepository(dbAdapter['db']);
    // Create a dummy project to link question sets to
    dbAdapter.createProject('Test Project');
  });

  afterEach(() => {
    dbAdapter.close();
  });

  it('creates and retrieves a global question set', () => {
    const qs = repo.createQuestionSet({
      project_id: null,
      name: 'Global Set',
      description: 'A global question set',
      questions: JSON.stringify(['What is the main finding?']),
    });

    expect(qs.id).toBeGreaterThan(0);
    expect(qs.name).toBe('Global Set');
    expect(qs.project_id).toBeNull();

    const retrieved = repo.getQuestionSet(qs.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Global Set');
  });

  it('creates and retrieves a project-specific question set', () => {
    const qs = repo.createQuestionSet({
      project_id: 1,
      name: 'Project Set',
      description: 'A project question set',
      questions: JSON.stringify(['Who are the authors?']),
    });

    expect(qs.project_id).toBe(1);

    const retrieved = repo.getQuestionSet(qs.id);
    expect(retrieved?.name).toBe('Project Set');
  });

  it('lists question sets available for a project (global + project-specific)', () => {
    repo.createQuestionSet({
      project_id: null,
      name: 'Global Set',
      description: '',
      questions: '[]',
    });
    repo.createQuestionSet({
      project_id: 1,
      name: 'Project Set',
      description: '',
      questions: '[]',
    });
    // Create a set for another project
    dbAdapter.createProject('Another Project');
    repo.createQuestionSet({
      project_id: 2,
      name: 'Another Project Set',
      description: '',
      questions: '[]',
    });

    const sets = repo.listQuestionSets(1);
    expect(sets.length).toBe(2);
    expect(sets.find((s) => s.name === 'Global Set')).toBeDefined();
    expect(sets.find((s) => s.name === 'Project Set')).toBeDefined();
    expect(sets.find((s) => s.name === 'Another Project Set')).toBeUndefined();
  });

  it('updates a question set', () => {
    const qs = repo.createQuestionSet({
      project_id: null,
      name: 'Old Name',
      description: 'Old Desc',
      questions: '[]',
    });

    repo.updateQuestionSet(qs.id, {
      name: 'New Name',
      questions: JSON.stringify(['New Question']),
    });

    const updated = repo.getQuestionSet(qs.id);
    expect(updated?.name).toBe('New Name');
    expect(updated?.description).toBe('Old Desc'); // Should remain unchanged if not provided
    expect(updated?.questions).toBe(JSON.stringify(['New Question']));
  });

  it('deletes a question set', () => {
    const qs = repo.createQuestionSet({
      project_id: null,
      name: 'To Delete',
      description: '',
      questions: '[]',
    });

    repo.deleteQuestionSet(qs.id);
    const retrieved = repo.getQuestionSet(qs.id);
    expect(retrieved).toBeUndefined();
  });

  it('duplicates a question set', () => {
    const qs = repo.createQuestionSet({
      project_id: null,
      name: 'Original',
      description: 'Desc',
      questions: JSON.stringify(['Q1']),
    });

    const duplicateId = repo.duplicateQuestionSet(qs.id, 1); // Duplicate to project 1
    const duplicated = repo.getQuestionSet(duplicateId);

    expect(duplicated).toBeDefined();
    expect(duplicated?.name).toBe('Original (Cópia)');
    expect(duplicated?.project_id).toBe(1);
    expect(duplicated?.questions).toBe(qs.questions);
  });

  it('rejects insertion of duplicates (same name and project)', () => {
    repo.createQuestionSet({
      project_id: 1,
      name: 'Duplicate Test',
      description: 'First',
      questions: '[]',
    });

    expect(() => {
      repo.createQuestionSet({
        project_id: 1,
        name: 'Duplicate Test',
        description: 'Second',
        questions: '[]',
      });
    }).toThrow('Question set with name "Duplicate Test" already exists in this project');
  });

  it('allows insertion of questionnaire with identical name in different projects', () => {
    const qs1 = repo.createQuestionSet({
      project_id: 1,
      name: 'Same Name Different Project',
      description: 'First',
      questions: '[]',
    });

    dbAdapter.createProject('Project 2');
    const qs2 = repo.createQuestionSet({
      project_id: 2,
      name: 'Same Name Different Project',
      description: 'Second',
      questions: '[]',
    });

    expect(qs1.id).not.toBe(qs2.id);
    expect(qs1.project_id).toBe(1);
    expect(qs2.project_id).toBe(2);
  });

  it('paginates question sets returning exact sizes', () => {
    for (let i = 1; i <= 5; i++) {
      repo.createQuestionSet({
        project_id: null,
        name: `Set ${i}`,
        description: '',
        questions: '[]',
      });
    }

    const firstPage = repo.listQuestionSets(null, 2, 0);
    expect(firstPage.length).toBe(2);
    expect(firstPage[0].name).toBe('Set 1');
    expect(firstPage[1].name).toBe('Set 2');

    const secondPage = repo.listQuestionSets(null, 2, 2);
    expect(secondPage.length).toBe(2);
    expect(secondPage[0].name).toBe('Set 3');
    expect(secondPage[1].name).toBe('Set 4');

    const thirdPage = repo.listQuestionSets(null, 2, 4);
    expect(thirdPage.length).toBe(1);
    expect(thirdPage[0].name).toBe('Set 5');
  });
});
