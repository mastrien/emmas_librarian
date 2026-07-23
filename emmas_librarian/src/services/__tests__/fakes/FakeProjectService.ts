import type {
  SearchHistoryRecord,
  TrashItem,
  ProjectCategory,
  ArticleCategory,
  AIModelConfig,
  AISkill,
  AIProvider,
  ScientificVenue,
  MilestoneStatus,
} from '../../../types';
import { vi, type Mock } from 'vitest';
import type {
  IProjectService,
  ExtractedMetadata,
  AutoBackupEntry,
  SearchPersistResult,
  ExtractionAnswer,
  ArticleSummary,
} from '../../ProjectServiceInterface';
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
} from '../../../types';

/**
 * Named fake for IProjectService. Every method is a `vi.fn()` wrapping a
 * sensible default so tests can override individual methods with
 * `.mockResolvedValue(...)` without touching the rest.
 *
 * Usage:
 *   const svc = FakeProjectService.create();
 *   svc.getProjects.mockResolvedValueOnce([mockProject]);
 */
export class FakeProjectService implements IProjectService {
  // ── Projects ────────────────────────────────────────────────────────
  getProjects = vi.fn(async (): Promise<Project[]> => []);

  createProject = vi.fn(
    async (_name: string): Promise<Project> => ({
      id: 0,
      name: '',
      created_at: '',
    }),
  );

  getProject = vi.fn(
    async (_projectId: number): Promise<Project> => ({
      id: 0,
      name: '',
      created_at: '',
    }),
  );

  updateProject = vi.fn(async (_id: number, _name: string): Promise<void> => undefined);

  getProjectWritingPad = vi.fn(async (_id: number): Promise<string | null> => null);

  updateProjectWritingPad = vi.fn(async (_id: number, _content: string): Promise<void> => undefined);

  deleteProject = vi.fn(async (_id: number): Promise<void> => undefined);

  // ── Search ──────────────────────────────────────────────────────────
  getSearchHistory = vi.fn(async (_projectId: number): Promise<unknown[]> => []);

  revertSearch = vi.fn(async (_searchId: number): Promise<void> => undefined);

  searchAndPersist = vi.fn(
    async (
      _projectId: number,
      _queryMap: Record<string, string>,
      _limit: number,
      _sortBy: string,
      _unifiedQuery: string,
    ): Promise<SearchPersistResult> => ({ savedCount: 0, breakdown: {} }),
  );

  translateQuery = vi.fn(async (_ast: QueryASTNode): Promise<DatabaseTranslationMap> => ({}));

  // ── Articles ────────────────────────────────────────────────────────
  getArticles = vi.fn(async (_projectId: number): Promise<Article[]> => []);

  getArticle = vi.fn(
    async (_articleId: number): Promise<Article> => ({
      id: 0,
      project_id: 0,
      title: '',
      status: 'new',
    }),
  );

  updateArticleStatus = vi.fn(
    async (_articleId: number, _status: 'new' | 'read' | 'archived', _note?: string): Promise<void> => undefined,
  );

  updateArticleMetadata = vi.fn(async (_articleId: number, _data: Partial<Article>): Promise<void> => undefined);

  createManualArticle = vi.fn(
    async (_projectId: number, _data: Partial<Article>, _sourceFilePath?: string): Promise<number> => 0,
  );

  createArticlesFromPdfs = vi.fn(async (_projectId: number, _filePaths: string[]): Promise<number> => 0);

  // ── Export ──────────────────────────────────────────────────────────
  exportCsv = vi.fn(async (_projectId: number): Promise<string | null> => null);

  exportXlsx = vi.fn(async (_projectId: number): Promise<string | null> => null);

  exportBiblioshiny = vi.fn(async (_projectId: number): Promise<string | null> => null);

  // ── Highlights ──────────────────────────────────────────────────────
  getHighlights = vi.fn(async (_articleId: number): Promise<Highlight[]> => []);

  createHighlight = vi.fn(
    async (
      _articleId: number,
      _color: string,
      _positionData: unknown,
      _contentText: string | null,
      _annotationContent?: string,
    ): Promise<{ id: number; annotation_id: number | null }> => ({
      id: 0,
      annotation_id: null,
    }),
  );

  deleteHighlight = vi.fn(async (_id: number): Promise<void> => undefined);

  // ── Annotations ─────────────────────────────────────────────────────
  getAnnotations = vi.fn(async (_articleId: number): Promise<Annotation[]> => []);

  createAnnotation = vi.fn(async (_articleId: number, _content: string): Promise<{ id: number }> => ({ id: 0 }));

  updateAnnotation = vi.fn(async (_id: number, _content: string): Promise<void> => undefined);

  deleteAnnotation = vi.fn(async (_id: number): Promise<void> => undefined);

  // ── Settings ────────────────────────────────────────────────────────
  getSetting = vi.fn(async (_key: string): Promise<string | null> => null);

  setSetting = vi.fn(async (_key: string, _value: string): Promise<void> => undefined);

  // ── AI Model Config ─────────────────────────────────────────────────
  getAiModelConfigs = vi.fn(async (): Promise<AIModelConfig[]> => []);

  updateAiModelConfig = vi.fn(
    async (_skill: AISkill, _provider: AIProvider, _modelName: string): Promise<void> => undefined,
  );

  restoreAiModelConfigDefaults = vi.fn(async (): Promise<void> => undefined);

  // ── Dialogs & PDF ───────────────────────────────────────────────────
  openPdfDialog = vi.fn(async (): Promise<string | null> => null);

  openMultiplePdfsDialog = vi.fn(async (): Promise<string[]> => []);

  uploadPdf = vi.fn(async (_articleId: number, _filePath: string): Promise<string> => '');

  unlinkPdf = vi.fn(async (_articleId: number): Promise<void> => undefined);

  getPdfBuffer = vi.fn(async (_articleId: number): Promise<ArrayBuffer> => new ArrayBuffer(0));

  saveExportedFile = vi.fn(async (_content: string, _defaultPath: string): Promise<boolean> => true);

  getStoredPdfs = vi.fn(async (): Promise<any[]> => []);

  deletePdfLibraryRecord = vi.fn(async (_filePath: string): Promise<number[]> => []);

  linkPdfToArticle = vi.fn(async (_articleId: number, _filePath: string): Promise<void> => undefined);

  uploadPdfToLibrary = vi.fn(async (_filePath: string): Promise<string> => '');

  importArticlesFromProject = vi.fn(
    async (_sourceProjectId: number, _destProjectId: number, _articleIds: number[]): Promise<number> => 0,
  );

  // ── Project Documents ───────────────────────────────────────────────
  documents: ProjectDocument[] = [];

  openProjectDocument = vi.fn(async (_url: string, _localFilePath?: string): Promise<void> => undefined);

  getProjectDocuments = vi.fn(async (projectId: number): Promise<ProjectDocument[]> => {
    return this.documents.filter((d) => d.project_id === projectId);
  });

  createProjectDocument = vi.fn(
    async (projectId: number, title: string, url?: string, sourceFilePath?: string, category?: string): Promise<number> => {
      const id = this.documents.length + 1;
      const doc: ProjectDocument = {
        id,
        project_id: projectId,
        title,
        url,
        local_file_path: sourceFilePath,
        created_at: new Date().toISOString(),
        position: this.documents.length,
        category,
      };
      this.documents.push(doc);
      return id;
    },
  );

  updateProjectDocument = vi.fn(
    async (id: number, title: string, url?: string | null, sourceFilePath?: string | null, category?: string | null): Promise<void> => {
      const idx = this.documents.findIndex((d) => d.id === id);
      if (idx !== -1) {
        this.documents[idx] = {
          ...this.documents[idx],
          title,
          url: url ?? undefined,
          local_file_path: sourceFilePath ?? undefined,
          category: category ?? undefined,
        };
      }
    },
  );

  reorderProjectDocuments = vi.fn(async (_projectId: number, orderedIds: number[]): Promise<void> => {
    orderedIds.forEach((id, newPos) => {
      const doc = this.documents.find((d) => d.id === id);
      if (doc) doc.position = newPos;
    });
    this.documents.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  });

  deleteProjectDocument = vi.fn(async (id: number): Promise<void> => {
    this.documents = this.documents.filter((d) => d.id !== id);
  });

  openProjectDocumentExternal = vi.fn(async (_url?: string, _filePath?: string): Promise<void> => undefined);

  // ── Diary ───────────────────────────────────────────────────────────
  getDiaryEntries = vi.fn(async (_projectId: number): Promise<unknown[]> => []);

  getDiaryEntry = vi.fn(async (_projectId: number, _entryDate: string): Promise<DiaryEntry | null> => null);

  saveDiaryEntry = vi.fn(async (_projectId: number, _entryDate: string, _content: string): Promise<void> => undefined);

  deleteDiaryEntry = vi.fn(async (_projectId: number, _entryDate: string): Promise<void> => undefined);

  getDiaryEntryHistory = vi.fn(async (_projectId: number, _entryDate: string): Promise<unknown[]> => []);

  restoreDiaryEntryVersion = vi.fn(async (_versionId: number): Promise<void> => undefined);

  // ── Trash ───────────────────────────────────────────────────────────
  getTrashItems = vi.fn(async (): Promise<unknown[]> => []);

  restoreTrashItem = vi.fn(
    async (_type: 'project' | 'article' | 'annotation', _id: number): Promise<void> => undefined,
  );

  deleteTrashItemPermanent = vi.fn(
    async (_type: 'project' | 'article' | 'annotation', _id: number): Promise<void> => undefined,
  );

  emptyTrash = vi.fn(async (): Promise<void> => undefined);

  // ── Backups ─────────────────────────────────────────────────────────
  exportBackup = vi.fn(async (): Promise<string | null> => null);

  restoreBackupOverride = vi.fn(async (): Promise<boolean> => false);

  restoreBackupMerge = vi.fn(async (): Promise<number> => 0);

  listAutoBackups = vi.fn(async (): Promise<AutoBackupEntry[]> => []);

  restoreAutoBackup = vi.fn(async (_filename: string): Promise<boolean> => false);

  getAppVersion = vi.fn(async (): Promise<string> => '0.0.0-fake');

  // ── AI ──────────────────────────────────────────────────────────────
  generateSummary = vi.fn(
    async (_articleId: number): Promise<ArticleSummary> => ({
      generalSummary: '',
      sectionSummary: '',
    }),
  );

  massiveExtraction = vi.fn(async (_articleId: number, _questions: string[]): Promise<ExtractionAnswer[]> => []);

  extractMetadata = vi.fn(async (_articleId: number): Promise<ExtractedMetadata> => ({}));

  // ── Pending Highlights ──────────────────────────────────────────────
  getPendingHighlights = vi.fn(async (_articleId: number): Promise<PendingHighlight[]> => []);

  deletePendingHighlight = vi.fn(async (_id: number): Promise<void> => undefined);

  // ── Massive Investigations ──────────────────────────────────────────
  getMassiveInvestigations = vi.fn(async (_projectId: number): Promise<MassiveInvestigation[]> => []);

  saveMassiveInvestigation = vi.fn(
    async (
      _projectId: number,
      _questions: string[],
      _articlesIds: number[],
      _modelUsed: string,
      _status: string,
    ): Promise<number> => 0,
  );

  // ── Investigation Results ──────────────────────────────────────────
  saveInvestigationResults = vi.fn(
    async (
      _investigationId: number,
      _articleId: number,
      _results: Array<{
        question: string;
        answer: string | null;
        quote: string | null;
        status: 'success' | 'error' | 'skipped';
        error_message: string | null;
      }>,
    ): Promise<void> => {},
  );

  getInvestigationResults = vi.fn(async (_investigationId: number): Promise<InvestigationResult[]> => []);

  getInvestigationResultsByArticle = vi.fn(
    async (_investigationId: number, _articleId: number): Promise<InvestigationResult[]> => [],
  );

  // ── Categories ──────────────────────────────────────────────────────
  getProjectCategories = vi.fn(async (_projectId: number): Promise<unknown[]> => []);

  createProjectCategory = vi.fn(
    async (_projectId: number, _name: string, _type: string, _options?: any): Promise<number> => 0,
  );

  updateProjectCategory = vi.fn(
    async (_categoryId: number, _name: string, _type: string, _options?: any): Promise<void> => undefined,
  );

  deleteProjectCategory = vi.fn(async (_categoryId: number): Promise<void> => undefined);

  getArticleCategories = vi.fn(async (_articleId: number): Promise<unknown[]> => []);

  setArticleCategory = vi.fn(
    async (_articleId: number, _categoryId: number, _value: string | null): Promise<void> => undefined,
  );

  getAllProjectArticleCategories = vi.fn(async (_projectId: number): Promise<unknown[]> => []);

  // ── Sync ────────────────────────────────────────────────────────────
  exportProject = vi.fn(async (_projectId: number): Promise<string | null> => null);

  importProject = vi.fn(async (_filePath?: string): Promise<number | null> => null);

  // ── Question Sets ─────────────────────────────────────────────────
  getQuestionSets = vi.fn<any>().mockResolvedValue([]);
  getQuestionSet = vi.fn<any>().mockResolvedValue({} as any);
  createQuestionSet = vi.fn<any>().mockResolvedValue(1);
  updateQuestionSet = vi.fn<any>().mockResolvedValue(undefined);
  deleteQuestionSet = vi.fn<any>().mockResolvedValue(undefined);
  duplicateQuestionSet = vi.fn<any>().mockResolvedValue(2);

  // ── Agenda / Scientific Venues ─────────────────────────────────────
  getScientificVenues = vi.fn(async (): Promise<ScientificVenue[]> => []);
  createScientificVenue = vi.fn(
    async (venueData: Omit<ScientificVenue, 'id' | 'created_at'>): Promise<ScientificVenue> => ({
      id: 1,
      ...venueData,
      created_at: new Date().toISOString(),
      milestones: (venueData.milestones || []).map((m, idx) => ({ id: idx + 1, venue_id: 1, ...m })),
    }),
  );
  updateScientificVenue = vi.fn(
    async (id: number, venueData: Omit<ScientificVenue, 'id' | 'created_at'>): Promise<ScientificVenue> => ({
      id,
      ...venueData,
      created_at: new Date().toISOString(),
      milestones: (venueData.milestones || []).map((m, idx) => ({ id: idx + 1, venue_id: id, ...m })),
    }),
  );
  deleteScientificVenue = vi.fn(async (_id: number): Promise<boolean> => true);
  toggleMilestoneStatus = vi.fn(async (_milestoneId: number, _status: MilestoneStatus): Promise<boolean> => true);

  // ── Factory & Utilities ─────────────────────────────────────────────

  /** Returns a fresh FakeProjectService with clean mock histories. */
  static create(): FakeProjectService {
    return new FakeProjectService();
  }

  /**
   * Clears `.mock.calls` and `.mock.results` on every mocked method
   * without removing custom implementations set via `.mockResolvedValue()`.
   *
   * Usage:
   *   beforeEach(() => fake.reset());
   */
  reset(): void {
    const keys = Object.getOwnPropertyNames(this);
    for (const key of keys) {
      const value = (this as Record<string, unknown>)[key];
      if (typeof value === 'function' && 'mockClear' in value) {
        (value as Mock).mockClear();
      }
    }
  }
}
