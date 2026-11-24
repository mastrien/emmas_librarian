import type { NewArticleInput, NewHighlightInput, ProjectWriter } from '../reader/ProjectReader';
import type { LocalLibrary } from './LocalLibrary';
import { rowById } from './localRows';

/**
 * Everything the phone may write in its own copy. In a project that came from the computer each write also
 * goes to the outbox, where the computer decides on it; in a project made here it just changes the copy.
 *
 * Usage:
 *   await new LocalWriter(library).saveDiaryEntry(3, '2026-11-21', 'Li dois artigos.');
 */
export class LocalWriter implements ProjectWriter {
  constructor(private readonly library: LocalLibrary) {}

  async saveDiaryEntry(projectId: number, date: string, content: string): Promise<void> {
    const project = rowById(this.library, 'projects', projectId);
    const page = this.library
      .rows('project_diary')
      .find((row) => row.project_id === project.uuid && row.entry_date === date);
    if (page) this.library.update('project_diary', page.uuid, { content });
    else this.library.create('project_diary', { project_id: project.uuid, entry_date: date, content });
  }

  async addQuickLink(projectId: number, title: string, url: string): Promise<void> {
    const project = rowById(this.library, 'projects', projectId);
    this.library.create('project_documents', {
      project_id: project.uuid,
      title,
      url,
      created_at: new Date().toISOString(),
      position: 0,
      category: null,
      last_opened_at: null,
    });
  }

  async markDocumentOpened(documentId: number): Promise<void> {
    const document = rowById(this.library, 'project_documents', documentId);
    this.library.update('project_documents', document.uuid, { last_opened_at: new Date().toISOString() });
  }

  async setArticleCategory(): Promise<void> {
    throw new Error('Categories do not sync with the phone yet; change them on the computer.');
  }

  async createProject(name: string): Promise<number> {
    return this.library.createOwnProject(name).id;
  }

  async addArticle(projectId: number, input: NewArticleInput): Promise<number> {
    const project = rowById(this.library, 'projects', projectId);
    const row = this.library.create('articles', {
      project_id: project.uuid,
      title: input.title,
      authors: input.authors ?? null,
      year: input.year ?? null,
      doi: input.doi ?? null,
      status: 'new',
      deleted_at: null,
    });
    return row.id;
  }

  /**
   * Marks a passage. With a note, three changes are made in the order the computer can apply them: the highlight,
   * the note that points to it, and the highlight's pointer back to the note.
   */
  async addHighlight(articleId: number, input: NewHighlightInput): Promise<void> {
    const article = rowById(this.library, 'articles', articleId);
    const highlight = this.library.create('highlights', {
      article_id: article.uuid,
      color: input.color,
      position_data: JSON.stringify(input.positionData),
      content_text: input.contentText,
      annotation_id: null,
    });
    if (!input.comment) return;
    const note = this.library.create('annotations', {
      article_id: article.uuid,
      highlight_id: highlight.uuid,
      content_markdown: input.comment,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    this.library.update('highlights', highlight.uuid, { annotation_id: note.uuid });
  }
}
