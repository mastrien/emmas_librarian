// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { InvestigationAuditRepository } from '../InvestigationAuditRepository';
import { registerAuditHandlers } from '../../ipc/handlers/auditHandlers';
import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../DatabaseAdapter';

class RecordingRegistrar {
  public handlers = new Map<string, (...args: unknown[]) => unknown>();
  handle(channel: string, listener: (...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }
}

describe('investigation audits (#48), against real SQLite', () => {
  let db: Database.Database;
  let repo: InvestigationAuditRepository;
  let investigation: number;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8'));
    const project = db.prepare("INSERT INTO projects (name) VALUES ('Tese')").run().lastInsertRowid;
    investigation = Number(
      db
        .prepare(
          "INSERT INTO massive_investigations (project_id, questions, articles_ids, model_used) VALUES (?, '[]', '[]', 'gpt-x')",
        )
        .run(project).lastInsertRowid,
    );
    repo = new InvestigationAuditRepository(db);
  });

  afterEach(() => db.close());

  it('has no audit until one is drawn, and keeps the draw as given', () => {
    expect(repo.getAudit(investigation)).toBeNull();

    const saved = repo.saveAudit(investigation, { seed: 48213, samplePercent: 12.5, minPerQuestion: 2 });

    expect(saved).toMatchObject({
      investigation_id: investigation,
      seed: 48213,
      sample_percent: 12.5,
      min_per_question: 2,
    });
    expect(repo.getAudit(investigation)).toEqual(saved);
  });

  it('replaces the draw when drawing again: one audit per investigation', () => {
    repo.saveAudit(investigation, { seed: 1, samplePercent: 10, minPerQuestion: 2 });
    repo.saveAudit(investigation, { seed: 2, samplePercent: 20, minPerQuestion: 3 });

    expect(db.prepare('SELECT COUNT(*) AS n FROM investigation_audits').get()).toEqual({ n: 1 });
    expect(repo.getAudit(investigation)).toMatchObject({ seed: 2, sample_percent: 20, min_per_question: 3 });
  });

  it.each([
    [{ seed: 1.5, samplePercent: 10, minPerQuestion: 2 }],
    [{ seed: 1, samplePercent: 0, minPerQuestion: 2 }],
    [{ seed: 1, samplePercent: 101, minPerQuestion: 2 }],
    [{ seed: 1, samplePercent: 10, minPerQuestion: 0 }],
  ])('refuses a draw outside the expected shape: %o', (params) => {
    expect(() => repo.saveAudit(investigation, params)).toThrowError(/ERR_INVALID_AUDIT.*Expected shape/);
    expect(repo.getAudit(investigation)).toBeNull();
  });

  it('goes away with its investigation', () => {
    repo.saveAudit(investigation, { seed: 1, samplePercent: 10, minPerQuestion: 2 });

    db.prepare('DELETE FROM massive_investigations WHERE id = ?').run(investigation);

    expect(repo.getAudit(investigation)).toBeNull();
  });

  it('lists a project’s audits for the comparison between models, and only that project’s', () => {
    const other = db.prepare("INSERT INTO projects (name) VALUES ('Outro')").run().lastInsertRowid;
    const foreign = Number(
      db
        .prepare("INSERT INTO massive_investigations (project_id, questions, articles_ids) VALUES (?, '[]', '[]')")
        .run(other).lastInsertRowid,
    );
    repo.saveAudit(investigation, { seed: 1, samplePercent: 10, minPerQuestion: 2 });
    repo.saveAudit(foreign, { seed: 2, samplePercent: 10, minPerQuestion: 2 });

    const project = db.prepare('SELECT project_id FROM massive_investigations WHERE id = ?').get(investigation) as {
      project_id: number;
    };
    expect(repo.getAuditsByProject(project.project_id).map((a) => a.investigation_id)).toEqual([investigation]);
  });

  it('answers through the IPC channels', async () => {
    const ipc = new RecordingRegistrar();
    registerAuditHandlers(ipc as never, { getDB: () => db } as unknown as DatabaseAdapter);
    const call = (channel: string, ...args: unknown[]) => ipc.handlers.get(channel)!({}, ...args);

    await call(IpcChannel.INVESTIGATION_AUDIT_SAVE, investigation, { seed: 5, samplePercent: 10, minPerQuestion: 1 });

    expect(await call(IpcChannel.INVESTIGATION_AUDIT_GET, investigation)).toMatchObject({ seed: 5 });
    expect(await call(IpcChannel.INVESTIGATION_AUDITS_BY_PROJECT, 1)).toHaveLength(1);
  });
});
