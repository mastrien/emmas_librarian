// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { registerScreeningHandlers } from '../../ipc/handlers/screeningHandlers';
import { IpcChannel, type ScreeningLabel } from '../../types';

class RecordingRegistrar {
  public handlers = new Map<string, (...args: unknown[]) => unknown>();
  handle(channel: string, listener: (...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }
}

let db: DatabaseAdapter;
let projectId: number;
let labels: ScreeningLabel[];

const label = (name: string) => labels.find((l) => l.name === name)!;

function addArticle(title: string, status: 'new' | 'read' | 'archived' = 'new', note: string | null = null): number {
  const sql = `INSERT INTO articles (project_id, title, status, archive_note, source_query, source_databases, csl_json)
               VALUES (?, ?, ?, ?, '', '', '{}')`;
  return Number(db.getDB().prepare(sql).run(projectId, title, status, note).lastInsertRowid);
}

const article = (id: number) =>
  db.getDB().prepare('SELECT status, archive_note FROM articles WHERE id = ?').get(id) as {
    status: string;
    archive_note: string | null;
  };

const decisionLabels = (id: number) =>
  db.getDB().prepare('SELECT stage, label_id FROM screening_decisions WHERE article_id = ? ORDER BY stage').all(id) as {
    stage: string;
    label_id: number;
  }[];

beforeEach(() => {
  db = new DatabaseAdapter(':memory:');
  projectId = db.createProject('Revisão').id;
  labels = db.screeningLabelRepo.listLabels(projectId);
});

afterEach(() => db.close());

describe('screening labels (#49), against real SQLite', () => {
  it('gives a project the default labels once, one of each kind', () => {
    const again = db.screeningLabelRepo.listLabels(projectId);

    expect(again.map((l) => [l.name, l.kind])).toEqual([
      ['Incluso', 'include'],
      ['Em dúvida', 'maybe'],
      ['Excluído', 'exclude'],
      ['Duplicado', 'removed'],
    ]);
  });

  it('adds a label at the end and refuses a name or kind outside the expected shape', () => {
    const created = db.screeningLabelRepo.createLabel(projectId, { name: '  Fora do escopo ', kind: 'exclude' });

    expect(created).toMatchObject({ name: 'Fora do escopo', kind: 'exclude', position: 4 });
    expect(() => db.screeningLabelRepo.createLabel(projectId, { name: ' ', kind: 'exclude' })).toThrowError(
      /ERR_INVALID_LABEL.*Expected shape/,
    );
    expect(() => db.screeningLabelRepo.createLabel(projectId, { name: 'X', kind: 'other' as never })).toThrowError(
      /ERR_INVALID_LABEL.*include \| maybe \| exclude \| removed/,
    );
  });

  it('moves a label among those of its kind only', () => {
    const scope = db.screeningLabelRepo.createLabel(projectId, { name: 'Fora do escopo', kind: 'exclude' });

    db.screeningLabelRepo.moveLabel(scope.id, -1);
    db.screeningLabelRepo.moveLabel(scope.id, -1);

    const excludes = db.screeningLabelRepo.listLabels(projectId).filter((l) => l.kind === 'exclude');
    expect(excludes.map((l) => l.name)).toEqual(['Fora do escopo', 'Excluído']);
  });

  it('creates the PRISMA 2020 labels it lacks, and only once', () => {
    db.screeningLabelRepo.applyPreset(projectId, 'prisma2020');
    const after = db.screeningLabelRepo.applyPreset(projectId, 'prisma2020');

    expect(after).toHaveLength(8);
    expect(after.map((l) => l.name)).toContain('Texto completo não recuperado');
    expect(() => db.screeningLabelRepo.applyPreset(projectId, 'cochrane')).toThrowError(
      /ERR_INVALID_PRESET.*prisma2020/,
    );
  });
});

describe('screening decisions and the project page (#49)', () => {
  it('archives an excluded article with the label and note as reason, and gives back "read" when undone', () => {
    const id = addArticle('A', 'read');

    db.screeningDecisionRepo.decide([id], label('Excluído').id, 'title', 'só radar');
    const excluded = article(id);
    db.screeningDecisionRepo.undecide([id], 'title');

    expect(excluded).toEqual({ status: 'archived', archive_note: 'Excluído · só radar' });
    expect(article(id)).toEqual({ status: 'read', archive_note: null });
  });

  it('lets the full-text decision win over the title one', () => {
    const id = addArticle('A');
    db.screeningDecisionRepo.decide([id], label('Incluso').id, 'title');

    db.screeningDecisionRepo.decide([id], label('Excluído').id, 'full');
    const afterFull = article(id).status;
    db.screeningDecisionRepo.undecide([id], 'full');

    expect(afterFull).toBe('archived');
    expect(article(id).status).toBe('new');
    expect(decisionLabels(id)).toEqual([{ stage: 'title', label_id: label('Incluso').id }]);
  });

  it('brings an excluded article back when it is included instead', () => {
    const id = addArticle('A', 'read');
    db.screeningDecisionRepo.decide([id], label('Duplicado').id, 'title');

    db.screeningDecisionRepo.decide([id], label('Em dúvida').id, 'title');

    expect(article(id)).toEqual({ status: 'read', archive_note: null });
  });

  it('leaves an article archived by hand alone until a decision says otherwise', () => {
    const id = addArticle('Antigo', 'archived', 'revisão');
    db.screeningDecisionRepo.decide([addArticle('Outro')], label('Incluso').id, 'title');
    const untouched = article(id);

    db.screeningDecisionRepo.decide([id], label('Incluso').id, 'title');

    expect(untouched).toEqual({ status: 'archived', archive_note: 'revisão' });
    expect(article(id)).toEqual({ status: 'new', archive_note: null });
  });

  it('drops the exclusion when the project page restores the article, keeping it read', () => {
    const id = addArticle('A', 'read');
    db.screeningDecisionRepo.decide([id], label('Excluído').id, 'title');

    db.updateArticleStatus(id, 'new');

    expect(article(id).status).toBe('read');
    expect(decisionLabels(id)).toEqual([]);
  });

  it('drops the inclusion when the project page archives the article', () => {
    const id = addArticle('A');
    db.screeningDecisionRepo.decide([id], label('Incluso').id, 'title');

    db.updateArticlesStatus([id], 'archived', 'mudei de ideia');

    expect(article(id)).toEqual({ status: 'archived', archive_note: 'mudei de ideia' });
    expect(decisionLabels(id)).toEqual([]);
  });

  it('keeps decisions when the project page only marks the article as read', () => {
    const id = addArticle('A');
    db.screeningDecisionRepo.decide([id], label('Incluso').id, 'title');

    db.updateArticleStatus(id, 'read');

    expect(decisionLabels(id)).toHaveLength(1);
  });

  it('lists only the decisions of the project, for many articles decided at once', () => {
    const ids = [addArticle('A'), addArticle('B')];
    const other = db.createProject('Outro').id;
    const foreign = Number(
      db
        .getDB()
        .prepare(
          "INSERT INTO articles (project_id, title, source_query, source_databases, csl_json) VALUES (?, 'C', '', '', '{}')",
        )
        .run(other).lastInsertRowid,
    );

    const decided = db.screeningDecisionRepo.decide(ids, label('Incluso').id, 'title');
    db.screeningDecisionRepo.decide([foreign], db.screeningLabelRepo.listLabels(other)[0].id, 'title');

    expect(decided).toBe(2);
    expect(db.screeningDecisionRepo.listDecisions(projectId).map((d) => d.article_id)).toEqual(ids);
  });

  it('exports one current decision per article, the full-text one when there is one', () => {
    const both = addArticle('A');
    const titleOnly = addArticle('B');
    db.screeningDecisionRepo.decide([both, titleOnly], label('Incluso').id, 'title');
    db.screeningDecisionRepo.decide([both], label('Excluído').id, 'full', 'desfecho');

    const rows = db.getScreeningExportRows(projectId);

    expect(rows).toEqual(
      expect.arrayContaining([
        { article_id: both, name: 'Excluído', kind: 'exclude', stage: 'full', note: 'desfecho' },
        { article_id: titleOnly, name: 'Incluso', kind: 'include', stage: 'title', note: null },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it('refuses a stage outside the expected shape', () => {
    expect(() =>
      db.screeningDecisionRepo.decide([addArticle('A')], label('Incluso').id, 'abstract' as never),
    ).toThrowError(/ERR_INVALID_STAGE.*'title' \| 'full'/);
  });
});

describe('renaming and deleting labels with decisions (#49)', () => {
  it('writes the new name on the articles a renamed label archived', () => {
    const id = addArticle('A');
    db.screeningDecisionRepo.decide([id], label('Excluído').id, 'title', 'nota');

    db.screeningLabelRepo.renameLabel(label('Excluído').id, 'Fora do escopo');

    expect(article(id).archive_note).toBe('Fora do escopo · nota');
  });

  it('moves the decisions of a deleted label to another of the same kind', () => {
    const scope = db.screeningLabelRepo.createLabel(projectId, { name: 'Fora do escopo', kind: 'exclude' });
    const id = addArticle('A');
    db.screeningDecisionRepo.decide([id], scope.id, 'title');

    db.screeningLabelRepo.deleteLabel(scope.id, label('Excluído').id);

    expect(article(id)).toEqual({ status: 'archived', archive_note: 'Excluído' });
    expect(decisionLabels(id)).toEqual([{ stage: 'title', label_id: label('Excluído').id }]);
  });

  it('brings back the articles of a deleted label when its decisions are not moved', () => {
    const id = addArticle('A', 'read');
    db.screeningDecisionRepo.decide([id], label('Excluído').id, 'title');

    db.screeningLabelRepo.deleteLabel(label('Excluído').id, null);

    expect(article(id)).toEqual({ status: 'read', archive_note: null });
    expect(decisionLabels(id)).toEqual([]);
  });

  it('refuses to move decisions to a label of another kind', () => {
    expect(() => db.screeningLabelRepo.deleteLabel(label('Excluído').id, label('Incluso').id)).toThrowError(
      /ERR_INVALID_LABEL.*kind 'exclude'/,
    );
    expect(db.screeningLabelRepo.listLabels(projectId)).toHaveLength(4);
  });
});

describe('screening IPC channels (#49)', () => {
  it('answers labels and decisions through the channels', async () => {
    const ipc = new RecordingRegistrar();
    registerScreeningHandlers(ipc as never, db);
    const call = (channel: string, ...args: unknown[]) => ipc.handlers.get(channel)!({}, ...args);
    const id = addArticle('A');

    const created = (await call(IpcChannel.SCREENING_LABEL_CREATE, projectId, {
      name: 'Novo',
      kind: 'include',
    })) as ScreeningLabel;
    await call(IpcChannel.SCREENING_DECIDE, [id], created.id, 'title', null);

    expect(await call(IpcChannel.SCREENING_LABELS_LIST, projectId)).toHaveLength(5);
    expect(await call(IpcChannel.SCREENING_DECISIONS_LIST, projectId)).toMatchObject([
      { article_id: id, label_id: created.id },
    ]);
    await call(IpcChannel.SCREENING_UNDECIDE, [id], 'title');
    expect(await call(IpcChannel.SCREENING_DECISIONS_LIST, projectId)).toEqual([]);
  });
});
