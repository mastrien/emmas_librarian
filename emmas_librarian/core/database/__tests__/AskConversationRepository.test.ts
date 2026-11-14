import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';

const ANSWER = { claims: [], steps: [] };

describe('AskConversationRepository (#53), on real SQLite', () => {
  let db: DatabaseAdapter;
  let projectId: number;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    projectId = db.createProject('Revisão').id;
  });

  const repo = () => db.askConversationRepo;

  function addArticle(project: number, pdf: string | null): number {
    const insert = db.getDB().prepare("INSERT INTO articles (project_id, title, local_file_path) VALUES (?, 'A', ?)");
    return Number(insert.run(project, pdf).lastInsertRowid);
  }

  it('keeps a conversation with its projects and messages', () => {
    const id = repo().create('Qual a amostra?');
    repo().setProjects(id, [projectId]);

    repo().addExchange(id, 'Qual a amostra?', {
      claims: [{ text: 'n = 30', citations: [], unverified: null }],
      steps: [],
    });

    const stored = repo().conversation(id);
    expect(stored).toMatchObject({ id, title: 'Qual a amostra?', projects: [{ id: projectId, name: 'Revisão' }] });
    expect(stored?.messages.map((m) => [m.role, m.content, m.answer !== null])).toEqual([
      ['user', 'Qual a amostra?', false],
      ['assistant', 'n = 30', true],
    ]);
  });

  it('does not find what does not exist', () => {
    expect(repo().conversation(999)).toBeNull();
  });

  it('lists the latest activity first', () => {
    const older = repo().create('antiga');
    const newer = repo().create('nova');
    db.getDB().prepare("UPDATE ask_conversations SET updated_at = '2020-01-01' WHERE id = ?").run(newer);

    expect(
      repo()
        .list()
        .map((c) => c.id),
    ).toEqual([older, newer]);

    db.getDB().prepare("UPDATE ask_conversations SET updated_at = '2020-01-01' WHERE id = ?").run(older);
    repo().addExchange(newer, 'q', ANSWER);

    expect(
      repo()
        .list()
        .map((c) => c.id),
    ).toEqual([newer, older]);
  });

  it('replaces the projects, once each', () => {
    const other = db.createProject('Outro').id;
    const id = repo().create('c');
    repo().setProjects(id, [projectId, projectId]);
    expect(repo().projects(id)).toHaveLength(1);

    repo().setProjects(id, [other]);

    expect(repo().projects(id)).toEqual([{ id: other, name: 'Outro' }]);
  });

  it('leaves a project in the trash out of the list and the count', () => {
    const id = repo().create('c');
    repo().setProjects(id, [projectId]);
    expect(repo().list()[0].project_count).toBe(1);

    db.deleteProject(projectId);

    expect(repo().projects(id)).toEqual([]);
    expect(repo().list()[0].project_count).toBe(0);
  });

  it('removes a conversation with its messages and links', () => {
    const id = repo().create('c');
    repo().setProjects(id, [projectId]);
    repo().addExchange(id, 'q', ANSWER);

    repo().remove(id);

    const rows = (table: string) => db.getDB().prepare(`SELECT count(*) AS n FROM ${table}`).get();
    expect(rows('ask_conversations')).toEqual({ n: 0 });
    expect(rows('ask_messages')).toEqual({ n: 0 });
    expect(rows('ask_conversation_projects')).toEqual({ n: 0 });
  });

  it('does not lose an answer it cannot read, showing it empty', () => {
    const id = repo().create('c');
    repo().addExchange(id, 'q', ANSWER);
    db.getDB().prepare("UPDATE ask_messages SET answer = '{oops' WHERE role = 'assistant'").run();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(repo().conversation(id)?.messages[1].answer).toEqual({ claims: [], steps: [] });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  // Deleting a project does not mean the PDF is gone (author's decision on #53).
  describe('citationAccess', () => {
    it('opens the article itself', () => {
      const article = addArticle(projectId, 'a.pdf');

      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'open', articleId: article });
    });

    it('says trash when the project is there, and it can come back', () => {
      const article = addArticle(projectId, 'a.pdf');
      db.deleteProject(projectId);
      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'trash' });

      db.getDB().prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(projectId);
      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'open', articleId: article });
    });

    it('says trash when only the article is there', () => {
      const article = addArticle(projectId, 'a.pdf');
      db.getDB().prepare("UPDATE articles SET deleted_at = '2026-01-01' WHERE id = ?").run(article);

      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'trash' });
    });

    it('opens the copy in another project when the project is deleted for good, since the PDF stays', () => {
      const article = addArticle(projectId, 'a.pdf');
      const other = db.createProject('Outro').id;
      const copy = addArticle(other, 'a.pdf');

      db.deleteProjectPermanent(projectId);

      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'open', articleId: copy });
    });

    it('prefers a copy that opens over the trash', () => {
      const article = addArticle(projectId, 'a.pdf');
      const copy = addArticle(db.createProject('Outro').id, 'a.pdf');

      db.deleteProject(projectId);

      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'open', articleId: copy });
    });

    it('says trash when the only copy left is there', () => {
      const article = addArticle(projectId, 'a.pdf');
      const other = db.createProject('Outro').id;
      addArticle(other, 'a.pdf');
      db.deleteProjectPermanent(projectId);

      db.deleteProject(other);

      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'trash' });
    });

    it('says gone only when neither the article nor the PDF is left', () => {
      const article = addArticle(projectId, 'a.pdf');

      db.deleteProjectPermanent(projectId);

      expect(repo().citationAccess(article, 'a.pdf')).toEqual({ kind: 'gone' });
    });

    it('does not take an article without a PDF for a copy', () => {
      addArticle(projectId, null);

      expect(repo().citationAccess(999, null)).toEqual({ kind: 'gone' });
    });
  });

  it('keeps the conversation when the project goes for good', () => {
    const id = repo().create('c');
    repo().setProjects(id, [projectId]);
    repo().addExchange(id, 'q', ANSWER);

    db.deleteProjectPermanent(projectId);

    expect(repo().conversation(id)?.messages).toHaveLength(2);
  });
});
