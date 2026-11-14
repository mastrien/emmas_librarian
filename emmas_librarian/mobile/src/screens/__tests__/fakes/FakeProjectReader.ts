import type {
  Annotation,
  Article,
  ArticleCategory,
  DiaryEntry,
  Highlight,
  Project,
  ProjectCategory,
  ProjectDocument,
} from '../../../../../src/types';
import type { ProjectReader, ProjectWriter } from '../../../reader/ProjectReader';

/**
 * A small library in memory for the screens: fill the lists a test needs; `writable = false` makes it
 * the read-only kind (a file). Writes change the lists, so a screen that reloads shows them, and are
 * recorded in `written`. `failWith` makes every read fail with that message.
 *
 * Usage:
 *   const reader = new FakeProjectReader();
 *   reader.articles.push(anArticle({ id: 5, title: 'A' }));
 *   render(<Library reader={reader} at="/projects/1" />);
 */
export class FakeProjectReader implements ProjectReader {
  projects: Project[] = [{ id: 1, name: 'Tese', created_at: '2026-01-01' }];
  articles: Article[] = [];
  highlights: Highlight[] = [];
  annotations: Annotation[] = [];
  diary: DiaryEntry[] = [];
  documents: ProjectDocument[] = [];
  categories: ProjectCategory[] = [];
  articleCategories: (ArticleCategory & { article_id: number })[] = [];
  pdfs = new Map<number, Uint8Array>();
  written: string[] = [];
  failWith: string | null = null;
  failWrites = false;

  constructor(private readonly writable = true) {}

  get source(): 'desktop' | 'file' {
    return this.writable ? 'desktop' : 'file';
  }

  get writer(): ProjectWriter | null {
    return this.writable ? this.writes : null;
  }

  private note(entry: string): void {
    if (this.failWrites) throw new Error('sem conexão');
    this.written.push(entry);
  }

  private readonly writes: ProjectWriter = {
    saveDiaryEntry: async (projectId, date, content) => {
      this.note(`saveDiaryEntry(${projectId}, ${date}, ${content})`);
      this.diary = this.diary.filter((entry) => entry.entry_date !== date);
      this.diary.push({ id: this.diary.length + 100, project_id: projectId, entry_date: date, content });
    },
    addQuickLink: async (projectId, title, url) => {
      this.note(`addQuickLink(${projectId}, ${title}, ${url})`);
      this.documents.push({ id: this.documents.length + 100, project_id: projectId, title, url, created_at: '' });
    },
    markDocumentOpened: async (documentId) => this.note(`markDocumentOpened(${documentId})`),
    setArticleCategory: async (articleId, categoryId, value) => {
      this.note(`setArticleCategory(${articleId}, ${categoryId}, ${value})`);
    },
  };

  private async read<T>(value: T): Promise<T> {
    if (this.failWith) throw new Error(this.failWith);
    return value;
  }

  listProjects = () => this.read(this.projects);
  listArticles = (projectId: number) => this.read(this.articles.filter((article) => article.project_id === projectId));
  getArticle = (articleId: number) => this.read(this.articles.find((article) => article.id === articleId) ?? null);
  listHighlights = (articleId: number) => this.read(this.highlights.filter((each) => each.article_id === articleId));
  listAnnotations = (articleId: number) => this.read(this.annotations.filter((each) => each.article_id === articleId));
  readPdf = (articleId: number) => this.read(this.pdfs.get(articleId) ?? null);
  listDiary = (projectId: number) => this.read(this.diary.filter((entry) => entry.project_id === projectId));
  listDocuments = (projectId: number) => this.read(this.documents.filter((each) => each.project_id === projectId));
  listCategories = (projectId: number) => this.read(this.categories.filter((each) => each.project_id === projectId));
  listArticleCategories = (articleId: number) =>
    this.read(this.articleCategories.filter((each) => each.article_id === articleId));
}

/** @example anArticle({ id: 5, title: 'A', local_file_path: '/pdfs/a.pdf' }) */
export function anArticle(fields: Partial<Article> & { id: number; title: string }): Article {
  return { project_id: 1, status: 'new', ...fields } as Article;
}
