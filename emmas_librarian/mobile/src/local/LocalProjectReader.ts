import type {
  Annotation,
  Article,
  ArticleCategory,
  DiaryEntry,
  Highlight,
  Project,
  ProjectCategory,
  ProjectDocument,
} from '../../../src/types';
import type { PdfStorage } from './storage';
import type { ProjectReader, ProjectStanding, ProjectWriter } from '../reader/ProjectReader';
import { LocalLibrary } from './LocalLibrary';
import { LocalWriter } from './LocalWriter';
import type { SyncedEntity } from '../../../core/sync/syncedTables';
import { projectUuidOf } from './rowTree';
import { childrenOf, isLive, rowById, typed } from './localRows';

function parsePosition(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * The phone's own copy of the library, read with no computer around (plan 2026-11-21). The same screens read it
 * as they read the live desktop or a project file; what is new is that it can also be written.
 *
 * Usage:
 *   const reader = new LocalProjectReader(library, pdfs);
 *   const projects = await reader.listProjects(); // each carries `origin` and `pendingChanges`
 */
export class LocalProjectReader implements ProjectReader {
  readonly source = 'local';
  readonly writer: ProjectWriter;

  constructor(
    private readonly library: LocalLibrary,
    private readonly pdfs: PdfStorage,
  ) {
    this.writer = new LocalWriter(library);
  }

  async listProjects(): Promise<Project[]> {
    return this.library
      .rows('projects')
      .filter(isLive)
      .map((row) => ({ ...typed<Project>(this.library, 'projects', row), ...this.standingOf(row.id) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  standingOf(projectId: number): ProjectStanding {
    const project = rowById(this.library, 'projects', projectId);
    const pending = this.library.state.outbox.filter(
      (entry) => this.projectOfOperation(entry.operation.entity, entry.operation.uuid) === project.uuid,
    );
    return { origin: this.library.state.origins[project.uuid] ?? 'synced', pendingChanges: pending.length };
  }

  /** The live rows of `entity` that belong to a parent row, as the screens know them. */
  private childrenTyped<T>(entity: SyncedEntity, column: string, parentEntity: SyncedEntity, parentId: number): T[] {
    const parent = rowById(this.library, parentEntity, parentId);
    return childrenOf(this.library, entity, column, parent.uuid).map((row) => typed<T>(this.library, entity, row));
  }

  async listArticles(projectId: number): Promise<Article[]> {
    return this.childrenTyped<Article>('articles', 'project_id', 'projects', projectId);
  }

  async getArticle(articleId: number): Promise<Article | null> {
    const row = this.library.rows('articles').find((candidate) => candidate.id === articleId && isLive(candidate));
    return row ? typed<Article>(this.library, 'articles', row) : null;
  }

  async listHighlights(articleId: number): Promise<Highlight[]> {
    const article = rowById(this.library, 'articles', articleId);
    return childrenOf(this.library, 'highlights', 'article_id', article.uuid).map((row) => {
      const note =
        typeof row.annotation_id === 'string' ? this.library.find('annotations', row.annotation_id) : undefined;
      return {
        id: String(row.id),
        article_id: articleId,
        color: String(row.color),
        position_data: parsePosition(row.position_data),
        content_text: (row.content_text as string | null) ?? null,
        annotation_id: note?.id ?? null,
        comment: note ? String(note.content_markdown ?? '') : undefined,
      };
    });
  }

  async listAnnotations(articleId: number): Promise<Annotation[]> {
    return this.childrenTyped<Annotation>('annotations', 'article_id', 'articles', articleId);
  }

  async readPdf(articleId: number): Promise<Uint8Array | null> {
    return this.pdfs.get(rowById(this.library, 'articles', articleId).uuid);
  }

  async pdfSize(articleId: number): Promise<number | null> {
    const uuid = rowById(this.library, 'articles', articleId).uuid;
    return (await this.pdfs.sizes())[uuid] ?? null;
  }

  async listDiary(projectId: number): Promise<DiaryEntry[]> {
    const project = rowById(this.library, 'projects', projectId);
    return childrenOf(this.library, 'project_diary', 'project_id', project.uuid)
      .map((row) => typed<DiaryEntry>(this.library, 'project_diary', row))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }

  async listDocuments(projectId: number): Promise<ProjectDocument[]> {
    return this.childrenTyped<ProjectDocument>('project_documents', 'project_id', 'projects', projectId);
  }

  // Categories are not part of the sync yet (docs/planos/2026-11-21_mobile_robusto.md), so there are none here.
  async listCategories(_projectId: number): Promise<ProjectCategory[]> {
    return [];
  }

  async listArticleCategories(_articleId: number): Promise<ArticleCategory[]> {
    return [];
  }

  private projectOfOperation(entity: Parameters<LocalLibrary['find']>[0], uuid: string): string | null {
    const row = this.library.find(entity, uuid);
    return row ? projectUuidOf(this.library.state, entity, row) : null;
  }
}
