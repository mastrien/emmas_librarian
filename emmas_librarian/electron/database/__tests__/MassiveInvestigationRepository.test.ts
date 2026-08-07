import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MassiveInvestigationRepository } from '../MassiveInvestigationRepository';
import fs from 'fs';
import path from 'path';

describe('MassiveInvestigationRepository', () => {
  let db: Database.Database;
  let repo: MassiveInvestigationRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);
    repo = new MassiveInvestigationRepository(db);

    // Insert a dummy project to satisfy foreign key constraints
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(1, 'Test Project');
  });

  afterEach(() => {
    db.close();
  });

  it('should save a massive investigation', () => {
    const id = repo.saveMassiveInvestigation(
      1,
      ['Question 1?', 'Question 2?'],
      [101, 102],
      'gemini-pro',
      'running'
    );
    expect(id).toBeTypeOf('number');
    expect(id).toBeGreaterThan(0);
  });

  it('should get massive investigations for a project', () => {
    repo.saveMassiveInvestigation(1, ['Q1'], [1], 'model1', 'done');
    repo.saveMassiveInvestigation(1, ['Q2'], [2], 'model2', 'pending');

    const invs = repo.getMassiveInvestigations(1) as any[];
    expect(invs.length).toBe(2);
    
    // Order is created_at DESC. Without delay, they might have the same created_at.
    expect(invs[0].project_id).toBe(1);
    expect(invs[1].project_id).toBe(1);
    
    const statuses = invs.map(i => i.status);
    expect(statuses).toContain('done');
    expect(statuses).toContain('pending');
  });
  
  it('should return empty array for project without investigations', () => {
    const invs = repo.getMassiveInvestigations(999);
    expect(invs).toEqual([]);
  });
});
