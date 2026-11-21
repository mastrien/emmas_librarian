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

/**
 * The few changes a phone may make (#33): the diary, quick access links and an article's categories.
 * Only a library reached through the desktop has one; a file opened on the phone is read-only.
 */
export interface ProjectWriter {
  saveDiaryEntry(projectId: number, date: string, content: string): Promise<void>;
  addQuickLink(projectId: number, title: string, url: string): Promise<void>;
  markDocumentOpened(documentId: number): Promise<void>;
  /** `value` is the text of a text category, or the chosen option ids joined by commas; null clears it. */
  setArticleCategory(articleId: number, categoryId: number, value: string | null): Promise<void>;
  /** Only the phone's own library: a project and an article that exist only here, and a marked passage. */
  createProject?(name: string): Promise<number>;
  addArticle?(projectId: number, input: NewArticleInput): Promise<number>;
  addHighlight?(articleId: number, input: NewHighlightInput): Promise<void>;
}

export interface NewArticleInput {
  title: string;
  authors?: string;
  year?: number;
  doi?: string;
}

/** A passage marked on a PDF page. `positionData` is the object the desktop's reader stores for a highlight. */
export interface NewHighlightInput {
  color: string;
  positionData: unknown;
  contentText: string;
  /** The note linked to the highlight; empty for none. */
  comment?: string;
}

/** What the phone adds to a project: where it came from, and how many of its changes await the computer. */
export interface ProjectStanding {
  origin: 'synced' | 'own';
  pendingChanges: number;
}

/**
 * What the mobile screens read, whatever is behind it: the desktop over the local network
 * (HttpProjectReader) or a .emmapcarc opened on the phone (ArchiveProjectReader). The screens never
 * know which one they have.
 *
 * Usage:
 *   const projects = await reader.listProjects();
 *   const pdf = await reader.readPdf(articleId); // null when the article has no PDF here
 */
export interface ProjectReader {
  readonly source: 'desktop' | 'file' | 'local';
  /** Null where nothing can be written. */
  readonly writer: ProjectWriter | null;
  listProjects(): Promise<Project[]>;
  /** Where a project came from and its waiting changes; only the phone's own library knows. */
  standingOf?(projectId: number): ProjectStanding;
  listArticles(projectId: number): Promise<Article[]>;
  getArticle(articleId: number): Promise<Article | null>;
  listHighlights(articleId: number): Promise<Highlight[]>;
  listAnnotations(articleId: number): Promise<Annotation[]>;
  readPdf(articleId: number): Promise<Uint8Array | null>;
  listDiary(projectId: number): Promise<DiaryEntry[]>;
  listDocuments(projectId: number): Promise<ProjectDocument[]>;
  listCategories(projectId: number): Promise<ProjectCategory[]>;
  listArticleCategories(articleId: number): Promise<ArticleCategory[]>;
}
