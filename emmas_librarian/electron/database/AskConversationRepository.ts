import type Database from 'better-sqlite3';
import type { AskAnswer, AskCitationAccess, AskConversationSummary } from '../../src/types/ask';

/** A message as it is kept: its citations have no situation yet, since that changes after the answer. */
export interface StoredMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  answer: AskAnswer | null;
  created_at: string;
}

export interface StoredConversation {
  id: number;
  title: string;
  projects: { id: number; name: string }[];
  messages: StoredMessage[];
}

interface MessageRow extends Omit<StoredMessage, 'answer'> {
  answer: string | null;
}

// An article a person can open: neither it nor its project is in the trash.
const OPEN_ARTICLES = `SELECT a.id FROM articles a JOIN projects p ON p.id = a.project_id
  WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL`;

const parsedAnswer = (answer: string | null): AskAnswer | null => {
  if (!answer) return null;
  try {
    return JSON.parse(answer) as AskAnswer;
  } catch (err) {
    console.error(JSON.stringify({ event: 'ask_answer_unreadable', error: String(err) }));
    return { claims: [], steps: [] };
  }
};

/**
 * Keeps the conversations of "Perguntar aos projetos" (#53). They outlive the projects they read: a deleted project
 * only leaves the conversation's list, and what was answered stays.
 *
 * @example const id = repo.create('Qual a amostra?');
 */
export class AskConversationRepository {
  constructor(private readonly db: Database.Database) {}

  create(title: string): number {
    return Number(this.db.prepare('INSERT INTO ask_conversations (title) VALUES (?)').run(title).lastInsertRowid);
  }

  /** Newest activity first. */
  list(): AskConversationSummary[] {
    return this.db
      .prepare(
        `SELECT c.id, c.title, c.updated_at,
           (SELECT count(*) FROM ask_conversation_projects cp JOIN projects p ON p.id = cp.project_id
             WHERE cp.conversation_id = c.id AND p.deleted_at IS NULL) AS project_count
         FROM ask_conversations c ORDER BY c.updated_at DESC, c.id DESC`,
      )
      .all() as AskConversationSummary[];
  }

  conversation(id: number): StoredConversation | null {
    const row = this.db.prepare('SELECT id, title FROM ask_conversations WHERE id = ?').get(id) as
      | { id: number; title: string }
      | undefined;
    return row ? { ...row, projects: this.projects(id), messages: this.messages(id) } : null;
  }

  /** The projects it answers with now, without those in the trash. */
  projects(id: number): { id: number; name: string }[] {
    return this.db
      .prepare(
        `SELECT p.id, p.name FROM ask_conversation_projects cp JOIN projects p ON p.id = cp.project_id
         WHERE cp.conversation_id = ? AND p.deleted_at IS NULL ORDER BY p.name`,
      )
      .all(id) as { id: number; name: string }[];
  }

  setProjects(id: number, projectIds: number[]): void {
    const insert = this.db.prepare('INSERT INTO ask_conversation_projects (conversation_id, project_id) VALUES (?, ?)');
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM ask_conversation_projects WHERE conversation_id = ?').run(id);
      new Set(projectIds).forEach((projectId) => insert.run(id, projectId));
    })();
  }

  /** The question and its answer go in together, so a conversation never ends in a question without an answer. */
  addExchange(id: number, question: string, answer: AskAnswer): void {
    const insert = this.db.prepare(
      'INSERT INTO ask_messages (conversation_id, role, content, answer) VALUES (?, ?, ?, ?)',
    );
    this.db.transaction(() => {
      insert.run(id, 'user', question, null);
      insert.run(id, 'assistant', answer.claims.map((claim) => claim.text).join('\n'), JSON.stringify(answer));
      this.db.prepare('UPDATE ask_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    })();
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM ask_conversations WHERE id = ?').run(id);
  }

  /**
   * Whether a citation can be opened now. A project being deleted does not mean the PDF is gone: another project can
   * share the file (the page is then the same), and the trash can be restored.
   */
  citationAccess(articleId: number, pdfPath: string | null): AskCitationAccess {
    const own = this.db.prepare(`${OPEN_ARTICLES} AND a.id = ?`).get(articleId) as { id: number } | undefined;
    const open = own ?? (pdfPath ? this.openArticleWithPdf(pdfPath) : undefined);
    if (open) return { kind: 'open', articleId: open.id };
    const kept = this.db
      .prepare('SELECT 1 FROM articles WHERE id = ? OR (local_file_path IS NOT NULL AND local_file_path = ?) LIMIT 1')
      .get(articleId, pdfPath);
    return kept ? { kind: 'trash' } : { kind: 'gone' };
  }

  private openArticleWithPdf(pdfPath: string): { id: number } | undefined {
    return this.db.prepare(`${OPEN_ARTICLES} AND a.local_file_path = ? LIMIT 1`).get(pdfPath) as
      | { id: number }
      | undefined;
  }

  private messages(id: number): StoredMessage[] {
    const rows = this.db
      .prepare('SELECT id, role, content, answer, created_at FROM ask_messages WHERE conversation_id = ? ORDER BY id')
      .all(id) as MessageRow[];
    return rows.map((row) => ({ ...row, answer: parsedAnswer(row.answer) }));
  }
}
