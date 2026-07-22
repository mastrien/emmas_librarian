/**
 * IProjectService — contract for every project-related IPC operation.
 *
 * WHY: Decouples UI components from the concrete Electron IPC transport so
 * tests can inject a fake implementation without touching window.electronAPI.
 *
 * Usage:
 *   const svc: IProjectService = projectService;   // real
 *   const svc: IProjectService = new FakeService(); // test double
 */
import type {
  Project,
  Article,
  Highlight,
  Annotation,
  DiaryEntry,
  PendingHighlight,
  ProjectDocument,
  MassiveInvestigation,
  QuestionSet,
  InvestigationResult,
  QueryASTNode,
  DatabaseTranslationMap,
  SearchHistoryRecord,
  TrashItem,
  ProjectCategory,
  ArticleCategory,
  AIModelConfig,
  AISkill,
  AIProvider,
} from '../types';

/** Return type for AI-powered metadata extraction. */
export interface ExtractedMetadata {
  authors?: string;
  year?: string;
  title?: string;
  abstract?: string;
  references_list?: string;
  error?: string;
  doi?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}

/** Shape of a single auto-backup entry. */
export interface AutoBackupEntry {
  filename: string;
  date: string;
  sizeBytes: number;
}

/** Shape of a search-and-persist result. */
export interface SearchPersistResult {
  savedCount: number;
  breakdown: Record<string, { count: number; error?: string }>;
}

/** Shape of a massive-extraction answer row. */
export interface ExtractionAnswer {
  question: string;
  answer: string;
  quote: string | null;
}

/** Shape of a generated article summary. */
export interface ArticleSummary {
  generalSummary: string;
  sectionSummary: string;
}

export interface IProjectService {
  // ── Projects ──────────────────────────────────────────────────────
  getProjects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  getProject(projectId: number): Promise<Project>;
  updateProject(id: number, name: string): Promise<void>;
  getProjectWritingPad(id: number): Promise<string | null>;
  updateProjectWritingPad(id: number, content: string): Promise<void>;
  deleteProject(id: number): Promise<void>;

  // ── Search ────────────────────────────────────────────────────────
  getSearchHistory(projectId: number): Promise<unknown[]>;
  revertSearch(searchId: number): Promise<void>;
  searchAndPersist(
    projectId: number,
    queryMap: Record<string, string>,
    limit: number,
    sortBy: string,
    unifiedQuery: string,
  ): Promise<SearchPersistResult>;
  translateQuery(ast: QueryASTNode): Promise<DatabaseTranslationMap>;

  // ── Articles ──────────────────────────────────────────────────────
  getArticles(projectId: number): Promise<Article[]>;
  getArticle(articleId: number): Promise<Article>;
  updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', note?: string): Promise<void>;
  updateArticleMetadata(articleId: number, data: Partial<Article>): Promise<void>;
  createManualArticle(projectId: number, data: Partial<Article>, sourceFilePath?: string): Promise<number>;
  createArticlesFromPdfs(projectId: number, filePaths: string[]): Promise<number>;

  // ── Export ─────────────────────────────────────────────────────────
  exportCsv(projectId: number): Promise<string | null>;
  exportXlsx(projectId: number): Promise<string | null>;
  exportBiblioshiny(projectId: number): Promise<string | null>;

  // ── Highlights & Annotations ──────────────────────────────────────
  getHighlights(articleId: number): Promise<Highlight[]>;
  createHighlight(
    articleId: number,
    color: string,
    positionData: unknown,
    contentText: string | null,
    annotationContent?: string,
  ): Promise<{ id: number; annotation_id: number | null }>;
  deleteHighlight(id: number): Promise<void>;
  getAnnotations(articleId: number): Promise<Annotation[]>;
  createAnnotation(articleId: number, content: string): Promise<{ id: number }>;
  updateAnnotation(id: number, content: string): Promise<void>;
  deleteAnnotation(id: number): Promise<void>;

  // ── Settings ──────────────────────────────────────────────────────
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // ── AI Model Config ───────────────────────────────────────────────
  getAiModelConfigs(): Promise<AIModelConfig[]>;
  updateAiModelConfig(skill: AISkill, provider: AIProvider, modelName: string): Promise<void>;
  restoreAiModelConfigDefaults(): Promise<void>;

  // ── Dialogs & PDF ─────────────────────────────────────────────────
  openPdfDialog(): Promise<string | null>;
  openMultiplePdfsDialog(): Promise<string[]>;
  saveExportedFile(content: string, defaultPath: string): Promise<boolean>;
  uploadPdf(articleId: number, filePath: string): Promise<string>;
  unlinkPdf(articleId: number): Promise<void>;
  getPdfBuffer(articleId: number): Promise<ArrayBuffer>;
  getStoredPdfs(): Promise<any[]>;
  deletePdfLibraryRecord(filePath: string): Promise<number[]>;
  linkPdfToArticle(articleId: number, filePath: string): Promise<void>;
  uploadPdfToLibrary(filePath: string): Promise<string>;
  importArticlesFromProject(sourceProjectId: number, destProjectId: number, articleIds: number[]): Promise<number>;

  // ── Project Documents ─────────────────────────────────────────────
  openProjectDocument(url?: string, localFilePath?: string): Promise<void>;
  getProjectDocuments(projectId: number): Promise<ProjectDocument[]>;
  createProjectDocument(projectId: number, title: string, url?: string | null, sourceFilePath?: string | null, category?: string | null): Promise<number>;
  updateProjectDocument(id: number, title: string, url?: string | null, sourceFilePath?: string | null, category?: string | null): Promise<void>;
  reorderProjectDocuments(projectId: number, orderedIds: number[]): Promise<void>;
  deleteProjectDocument(id: number): Promise<void>;
  openProjectDocumentExternal(url?: string, filePath?: string): Promise<void>;

  // ── Diary ─────────────────────────────────────────────────────────
  getDiaryEntries(projectId: number): Promise<unknown[]>;
  getDiaryEntry(projectId: number, entryDate: string): Promise<DiaryEntry | null>;
  saveDiaryEntry(projectId: number, entryDate: string, content: string): Promise<void>;
  deleteDiaryEntry(projectId: number, entryDate: string): Promise<void>;
  getDiaryEntryHistory(projectId: number, entryDate: string): Promise<unknown[]>;
  restoreDiaryEntryVersion(versionId: number): Promise<void>;

  // ── Trash ─────────────────────────────────────────────────────────
  getTrashItems(): Promise<unknown[]>;
  restoreTrashItem(type: 'project' | 'article' | 'annotation', id: number): Promise<void>;
  deleteTrashItemPermanent(type: 'project' | 'article' | 'annotation', id: number): Promise<void>;
  emptyTrash(): Promise<void>;

  // ── Backups ───────────────────────────────────────────────────────
  exportBackup(): Promise<string | null>;
  restoreBackupOverride(): Promise<boolean>;
  restoreBackupMerge(): Promise<number>;
  listAutoBackups(): Promise<AutoBackupEntry[]>;
  restoreAutoBackup(filename: string): Promise<boolean>;
  getAppVersion(): Promise<string>;

  // ── AI ────────────────────────────────────────────────────────────
  generateSummary(articleId: number): Promise<ArticleSummary>;
  massiveExtraction(articleId: number, questions: string[]): Promise<ExtractionAnswer[]>;
  extractMetadata(articleId: number): Promise<ExtractedMetadata>;

  // ── Pending Highlights ────────────────────────────────────────────
  getPendingHighlights(articleId: number): Promise<PendingHighlight[]>;
  deletePendingHighlight(id: number): Promise<void>;

  // ── Massive Investigations ────────────────────────────────────────
  getMassiveInvestigations(projectId: number): Promise<MassiveInvestigation[]>;
  saveMassiveInvestigation(
    projectId: number,
    questions: string[],
    articlesIds: number[],
    modelUsed: string,
    status: string,
  ): Promise<number>;

  // ── Investigation Results ──────────────────────────────────────────
  saveInvestigationResults(
    investigationId: number,
    articleId: number,
    results: Array<{
      question: string;
      answer: string | null;
      quote: string | null;
      status: 'success' | 'error' | 'skipped';
      error_message: string | null;
    }>,
  ): Promise<void>;
  getInvestigationResults(investigationId: number): Promise<InvestigationResult[]>;
  getInvestigationResultsByArticle(investigationId: number, articleId: number): Promise<InvestigationResult[]>;

  // ── Categories ────────────────────────────────────────────────────
  getProjectCategories(projectId: number): Promise<unknown[]>;
  createProjectCategory(
    projectId: number,
    name: string,
    type: string,
    options?: Record<string, unknown> | null,
  ): Promise<number>;
  updateProjectCategory(
    categoryId: number,
    name: string,
    type: string,
    options?: Record<string, unknown> | null,
  ): Promise<void>;
  deleteProjectCategory(categoryId: number): Promise<void>;
  getArticleCategories(articleId: number): Promise<unknown[]>;
  setArticleCategory(articleId: number, categoryId: number, value: string | null): Promise<void>;
  getAllProjectArticleCategories(projectId: number): Promise<unknown[]>;

  // ── Question Sets ─────────────────────────────────────────────────
  getQuestionSets(projectId: number | null): Promise<QuestionSet[]>;
  getQuestionSet(id: number): Promise<QuestionSet>;
  createQuestionSet(data: {
    project_id: number | null;
    name: string;
    description?: string;
    questions: string[];
  }): Promise<number>;
  updateQuestionSet(id: number, data: { name?: string; description?: string; questions?: string[] }): Promise<void>;
  deleteQuestionSet(id: number): Promise<void>;
  duplicateQuestionSet(id: number, projectId: number | null): Promise<number>;

  // ── Sync ──────────────────────────────────────────────────────────
  exportProject(projectId: number): Promise<string | null>;
  importProject(filePath?: string): Promise<number | null>;
}
