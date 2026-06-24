import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { InvestigationResultRepository, InvestigationResultInput } from '../InvestigationResultRepository';

describe('InvestigationResultRepository', () => {
  let db: Database.Database;
  let repo: InvestigationResultRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    db.exec(schema);

    // Prerequisite rows for FK constraints
    db.exec(`INSERT INTO projects (name) VALUES ('Test Project')`);
    db.exec(`INSERT INTO articles (project_id, title, status) VALUES (1, 'Test Article', 'new')`);
    db.exec(`INSERT INTO articles (project_id, title, status) VALUES (1, 'Second Article', 'new')`);
    db.exec(
      `INSERT INTO massive_investigations (project_id, questions, articles_ids, model_used, status)
       VALUES (1, '["Q1","Q2"]', '[1,2]', 'GPT-4', 'success')`,
    );

    repo = new InvestigationResultRepository(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  // ── saveResultsBatch ──────────────────────────────────────────────

  it('inserts multiple results in a single call', () => {
    const inputs: InvestigationResultInput[] = [
      {
        question: 'What is the main finding?',
        answer: 'Result A',
        quote: '"Evidence A"',
        status: 'success',
        error_message: null,
      },
      {
        question: 'Who funded it?',
        answer: null,
        quote: null,
        status: 'error',
        error_message: 'LLM timeout',
      },
    ];

    repo.saveResultsBatch(1, 1, inputs);

    const rows = db.prepare('SELECT * FROM investigation_results WHERE investigation_id = 1').all() as {
      question: string;
      status: string;
    }[];

    expect(rows).toHaveLength(2);
    expect(rows[0].question).toBe('What is the main finding?');
    expect(rows[1].status).toBe('error');
  });

  it('does not throw when given an empty array', () => {
    expect(() => repo.saveResultsBatch(1, 1, [])).not.toThrow();

    const rows = db.prepare('SELECT * FROM investigation_results').all();

    expect(rows).toHaveLength(0);
  });

  // ── getResultsByInvestigation ─────────────────────────────────────

  it('returns all results for an investigation ordered by article_id, id', () => {
    const input: InvestigationResultInput = {
      question: 'Q1',
      answer: 'A1',
      quote: null,
      status: 'success',
      error_message: null,
    };

    // Insert for article 2 first, then article 1
    repo.saveResultsBatch(1, 2, [input]);
    repo.saveResultsBatch(1, 1, [input]);

    const rows = repo.getResultsByInvestigation(1);

    expect(rows).toHaveLength(2);
    // article_id=1 should come before article_id=2
    expect(rows[0].article_id).toBe(1);
    expect(rows[1].article_id).toBe(2);
  });

  // ── getResultsByArticle ───────────────────────────────────────────

  it('filters results by investigation AND article', () => {
    const input: InvestigationResultInput = {
      question: 'Q1',
      answer: 'A1',
      quote: null,
      status: 'success',
      error_message: null,
    };

    repo.saveResultsBatch(1, 1, [input]);
    repo.saveResultsBatch(1, 2, [input, input]);

    const rows = repo.getResultsByArticle(1, 2);

    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.article_id).toBe(2);
      expect(row.investigation_id).toBe(1);
    });
  });

  // ── deleteByInvestigation ─────────────────────────────────────────

  it('removes all results for an investigation', () => {
    const input: InvestigationResultInput = {
      question: 'Q1',
      answer: 'A1',
      quote: null,
      status: 'success',
      error_message: null,
    };

    repo.saveResultsBatch(1, 1, [input, input]);
    repo.saveResultsBatch(1, 2, [input]);

    repo.deleteByInvestigation(1);

    const remaining = db.prepare('SELECT * FROM investigation_results').all();

    expect(remaining).toHaveLength(0);
  });
});
