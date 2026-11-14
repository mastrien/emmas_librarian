import { unzipSync, strFromU8 } from 'fflate';
import { assertReadableProjectFormat } from '../../../core/database/backup/projectFileFormat';
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
import type { ProjectReader } from './ProjectReader';

type Row = Record<string, unknown>;

/** The lists of `project.json` this reader uses; the optional ones are missing in files of older versions. */
interface ProjectJson {
  formatVersion?: unknown;
  project: Row;
  articles: Row[];
  projectDocs?: Row[];
  projCategories?: Row[];
  categoryOptions?: Row[];
  articleCategories?: Row[];
  categorySelections?: Row[];
  annotations?: Row[];
  highlights?: Row[];
  diaryEntries?: Row[];
}

const PROJECT_JSON = 'project.json';
const PDF_FOLDER = 'pdfs/';

const live = (rows: Row[] | undefined): Row[] => (rows ?? []).filter((row) => !row.deleted_at);
const of = (rows: Row[], column: string, id: number) => rows.filter((row) => row[column] === id);
// The file stores the desktop's path; inside the archive the PDF is under pdfs/ with the same file name.
const fileNameOf = (filePath: unknown) =>
  String(filePath ?? '')
    .split(/[\\/]/)
    .pop() ?? '';

function readProjectJson(archive: Uint8Array): ProjectJson {
  const entry = unzipSync(archive, { filter: (file) => file.name === PROJECT_JSON })[PROJECT_JSON];
  if (!entry) {
    throw new Error(
      "Arquivo de projeto inválido: o .emmapcarc não contém project.json, esperado um projeto exportado pelo Emma's Librarian",
    );
  }
  const parsed = JSON.parse(strFromU8(entry)) as ProjectJson;
  assertReadableProjectFormat(parsed);
  return parsed;
}

/**
 * A project exported by the desktop (.emmapcarc), read on the phone with no desktop around: the same
 * screens, nothing to write. The archive stays zipped in memory and each PDF is unpacked when opened,
 * so a project with many PDFs does not need them all at once.
 *
 * Usage:
 *   const reader = new ArchiveProjectReader(new Uint8Array(await file.arrayBuffer()));
 *   const [project] = await reader.listProjects();
 */
export class ArchiveProjectReader implements ProjectReader {
  readonly source = 'file';
  readonly writer = null;
  private readonly rows: ProjectJson;

  /** Throws when the file is not a project, or was written in a format newer than this app reads. */
  constructor(private readonly archive: Uint8Array) {
    this.rows = readProjectJson(archive);
  }

  private get projectId(): number {
    return Number(this.rows.project.id);
  }

  private articles(): Article[] {
    return live(this.rows.articles) as unknown as Article[];
  }

  async listProjects(): Promise<Project[]> {
    return [this.rows.project as unknown as Project];
  }

  async listArticles(projectId: number): Promise<Article[]> {
    return projectId === this.projectId ? this.articles() : [];
  }

  async getArticle(articleId: number): Promise<Article | null> {
    return this.articles().find((article) => article.id === articleId) ?? null;
  }

  // As the desktop answers them: each highlight with the text of the note linked to it.
  async listHighlights(articleId: number): Promise<Highlight[]> {
    const notes = new Map(live(this.rows.annotations).map((note) => [note.id, note.content_markdown]));
    return of(this.rows.highlights ?? [], 'article_id', articleId).map(
      (highlight) => ({ ...highlight, comment: notes.get(highlight.annotation_id) }) as unknown as Highlight,
    );
  }

  async listAnnotations(articleId: number): Promise<Annotation[]> {
    return of(live(this.rows.annotations), 'article_id', articleId) as unknown as Annotation[];
  }

  async readPdf(articleId: number): Promise<Uint8Array | null> {
    const article = await this.getArticle(articleId);
    const name = PDF_FOLDER + fileNameOf(article?.local_file_path);
    if (name === PDF_FOLDER) return null;
    return unzipSync(this.archive, { filter: (file) => file.name === name })[name] ?? null;
  }

  async listDiary(projectId: number): Promise<DiaryEntry[]> {
    return of(this.rows.diaryEntries ?? [], 'project_id', projectId) as unknown as DiaryEntry[];
  }

  async listDocuments(projectId: number): Promise<ProjectDocument[]> {
    return of(live(this.rows.projectDocs), 'project_id', projectId) as unknown as ProjectDocument[];
  }

  async listCategories(projectId: number): Promise<ProjectCategory[]> {
    const options = this.rows.categoryOptions ?? [];
    return of(this.rows.projCategories ?? [], 'project_id', projectId).map(
      (category) =>
        ({ ...category, parsedOptions: of(options, 'category_id', Number(category.id)) }) as unknown as ProjectCategory,
    );
  }

  // As the desktop answers: the text values first, then one entry per category with chosen options,
  // whose `value` is the option names joined (ArticleCategoryRepository.getArticleCategories).
  async listArticleCategories(articleId: number): Promise<ArticleCategory[]> {
    const categories = await this.listCategories(this.projectId);
    const texts = categories.flatMap((category) => this.textValues(articleId, category));
    return [...texts, ...categories.flatMap((category) => this.chosenOptions(articleId, category) ?? [])];
  }

  private rowsOf(rows: Row[] | undefined, articleId: number, category: ProjectCategory): Row[] {
    return of(rows ?? [], 'article_id', articleId).filter((row) => row.category_id === category.id);
  }

  private textValues(articleId: number, category: ProjectCategory): ArticleCategory[] {
    const base = { category_id: category.id, name: category.name, type: category.type };
    return this.rowsOf(this.rows.articleCategories, articleId, category).map((row) => ({
      ...base,
      value: String(row.value ?? ''),
    }));
  }

  private chosenOptions(articleId: number, category: ProjectCategory): ArticleCategory | null {
    const chosen = this.rowsOf(this.rows.categorySelections, articleId, category).map((row) => Number(row.option_id));
    if (chosen.length === 0) return null;
    const names = (category.parsedOptions ?? [])
      .filter((option) => chosen.includes(Number(option.id)))
      .map((option) => option.name);
    const base = { category_id: category.id, name: category.name, type: category.type };
    return { ...base, value: names.join(', '), option_ids: chosen, option_names: names };
  }
}
