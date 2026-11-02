import type { SearchLimits } from '../../../utils/searchLimits';
import type { CategorySetEntry, CategorySetResult } from '../../../utils/categoryTemplates';
import type { AuditParams } from '../../../utils/auditSampling';
import { DEFAULT_LABELS, SCREENING_PRESETS } from '../../../utils/screeningPresets';
import type { CategoryOption, OpenAccessOutcome, SearchReportFormat } from '../../../types';
import type {
  SearchHistoryItem,
  SearchPreview,
  SavedSearchSummary,
  ProjectCategory,
  ArticleCategory,
  AIModelConfig,
  AISkill,
  AIProvider,
  ScientificVenue,
  MilestoneStatus,
  UpdateStatusResponse,
  UpdateInfoPayload,
  DownloadProgressPayload,
} from '../../../types';
import { vi, type Mock } from 'vitest';
import type {
  IProjectService,
  QuestionSetInput,
  ExtractedMetadata,
  AutoBackupEntry,
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
  ResultReview,
  InvestigationAudit,
  ScreeningDecision,
  ScreeningLabel,
  ScreeningLabelInput,
  ScreeningStage,
  PrismaImageFormat,
  PrismaExportTables,
  PrismaRecords,
  PrismaSourceInput,
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
  getSearchHistory = vi.fn(async (_projectId: number): Promise<SearchHistoryItem[]> => []);

  revertSearch = vi.fn(async (_searchId: number): Promise<void> => undefined);

  previewSearch = vi.fn(
    async (
      _projectId: number,
      _queryMap: Record<string, string>,
      _limits: SearchLimits,
      _sortBy: string,
      _unifiedQuery: string,
      _queryState?: string,
    ): Promise<SearchPreview> => ({ previewId: 'preview-1', breakdown: {}, results: [] }),
  );
  saveSearchPreview = vi.fn(
    async (_previewId: string): Promise<SavedSearchSummary> => ({ savedCount: 0, breakdown: {} }),
  );
  discardSearchPreview = vi.fn(async (_previewId: string): Promise<void> => undefined);

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
  updateArticlesStatus = vi.fn(
    async (articleIds: number[], _status: 'new' | 'read' | 'archived', _note?: string): Promise<number> =>
      articleIds.length,
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

  exportSearchReport = vi.fn(async (_projectId: number, _format: SearchReportFormat): Promise<string | null> => null);

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

  fetchOpenAccessPdf = vi.fn(async (_articleId: number): Promise<OpenAccessOutcome> => ({ status: 'not-open' }));

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
    async (
      projectId: number,
      title: string,
      url?: string,
      sourceFilePath?: string,
      category?: string,
    ): Promise<number> => {
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
    async (
      id: number,
      title: string,
      url?: string | null,
      sourceFilePath?: string | null,
      category?: string | null,
    ): Promise<void> => {
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

  restoreBackupMerge = vi.fn(async (): Promise<number | null> => 0);

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

  getInvestigationAudit = vi.fn(async (_investigationId: number): Promise<InvestigationAudit | null> => null);

  saveInvestigationAudit = vi.fn(
    async (investigationId: number, params: AuditParams): Promise<InvestigationAudit> => ({
      id: 1,
      investigation_id: investigationId,
      seed: params.seed,
      sample_percent: params.samplePercent,
      min_per_question: params.minPerQuestion,
      created_at: '',
    }),
  );

  getInvestigationAuditsByProject = vi.fn(async (_projectId: number): Promise<InvestigationAudit[]> => []);

  // ── Screening (#49) ─────────────────────────────────────────────
  // Kept in memory, so a screen that decides and then reloads sees its own decisions, as with the real database.
  // It does not archive articles: tests of that rule run against real SQLite (ScreeningRepository.test.ts).
  screeningLabels: ScreeningLabel[] = DEFAULT_LABELS.map((l, i) => ({
    id: i + 1,
    project_id: 1,
    name: l.name,
    kind: l.kind,
    position: i,
    preset_key: l.key,
    created_at: '',
  }));
  screeningDecisions: ScreeningDecision[] = [];

  getScreeningLabels = vi.fn(async (_projectId: number): Promise<ScreeningLabel[]> => [...this.screeningLabels]);

  createScreeningLabel = vi.fn(async (projectId: number, input: ScreeningLabelInput): Promise<ScreeningLabel> => {
    const label = {
      id: this.screeningLabels.length + 100,
      project_id: projectId,
      ...input,
      position: 99,
      preset_key: null,
      created_at: '',
    };
    this.screeningLabels = [...this.screeningLabels, label];
    return label;
  });

  renameScreeningLabel = vi.fn(async (labelId: number, name: string): Promise<ScreeningLabel> => {
    this.screeningLabels = this.screeningLabels.map((l) => (l.id === labelId ? { ...l, name } : l));
    return this.screeningLabels.find((l) => l.id === labelId)!;
  });

  moveScreeningLabel = vi.fn(async (_labelId: number, _step: -1 | 1): Promise<void> => {});

  deleteScreeningLabel = vi.fn(async (labelId: number, moveTo: number | null): Promise<void> => {
    this.screeningLabels = this.screeningLabels.filter((l) => l.id !== labelId);
    this.screeningDecisions = this.screeningDecisions
      .map((d) => (d.label_id === labelId && moveTo !== null ? { ...d, label_id: moveTo } : d))
      .filter((d) => d.label_id !== labelId);
  });

  applyScreeningPreset = vi.fn(async (projectId: number, presetKey: string): Promise<ScreeningLabel[]> => {
    const known = new Set(this.screeningLabels.map((l) => l.preset_key));
    const missing = (SCREENING_PRESETS[presetKey] ?? []).filter((p) => !known.has(p.key));
    missing.forEach((p) => {
      const id = this.screeningLabels.length + 100;
      this.screeningLabels.push({
        id,
        project_id: projectId,
        name: p.name,
        kind: p.kind,
        position: id,
        preset_key: p.key,
        created_at: '',
      });
    });
    return [...this.screeningLabels];
  });

  getScreeningDecisions = vi.fn(
    async (_projectId: number): Promise<ScreeningDecision[]> => [...this.screeningDecisions],
  );

  decideScreening = vi.fn(
    async (articleIds: number[], labelId: number, stage: ScreeningStage, note?: string | null): Promise<number> => {
      const kept = this.screeningDecisions.filter((d) => !(articleIds.includes(d.article_id) && d.stage === stage));
      const added = articleIds.map((article_id, i) => ({
        id: Date.now() + i,
        article_id,
        label_id: labelId,
        stage,
        note: note ?? null,
        status_before: null,
        decided_at: '',
      }));
      this.screeningDecisions = [...kept, ...added];
      return articleIds.length;
    },
  );

  // ── PRISMA diagram (#50) ────────────────────────────────────────
  prismaRecords: PrismaRecords = { sources: [], origins: [], studyLinks: [] };

  private prismaSnapshot(): PrismaRecords {
    const r = this.prismaRecords;
    return { sources: [...r.sources], origins: [...r.origins], studyLinks: [...r.studyLinks] };
  }

  getPrismaRecords = vi.fn(async (_projectId: number): Promise<PrismaRecords> => this.prismaSnapshot());

  savePrismaSource = vi.fn(async (projectId: number, input: PrismaSourceInput): Promise<PrismaRecords> => {
    const id = input.id ?? this.prismaRecords.sources.length + 1;
    const source = {
      id,
      project_id: projectId,
      name: input.name,
      method: input.method,
      url: input.url ?? null,
      consulted_on: input.consulted_on ?? null,
    };
    this.prismaRecords.sources = [...this.prismaRecords.sources.filter((s) => s.id !== id), source];
    return this.prismaSnapshot();
  });

  setPrismaOrigins = vi.fn(
    async (_projectId: number, articleIds: number[], sourceId: number | null): Promise<PrismaRecords> => {
      const kept = this.prismaRecords.origins.filter((o) => !articleIds.includes(o.article_id));
      const added = sourceId === null ? [] : articleIds.map((article_id) => ({ article_id, source_id: sourceId }));
      this.prismaRecords.origins = [...kept, ...added];
      return this.prismaSnapshot();
    },
  );

  // Simpler than the repository: enough for the tab's tests, which link articles that are in no study yet.
  linkSameStudy = vi.fn(async (_projectId: number, articleId: number, otherId: number): Promise<PrismaRecords> => {
    this.prismaRecords.studyLinks = [
      ...this.prismaRecords.studyLinks,
      { article_id: otherId, study_article_id: articleId },
    ];
    return this.prismaSnapshot();
  });

  unlinkStudy = vi.fn(async (_projectId: number, studyArticleId: number): Promise<PrismaRecords> => {
    this.prismaRecords.studyLinks = this.prismaRecords.studyLinks.filter((l) => l.study_article_id !== studyArticleId);
    return this.prismaSnapshot();
  });

  exportPrismaDiagram = vi.fn(
    async (
      _projectId: number,
      _format: PrismaImageFormat,
      _image: string,
      _tables: PrismaExportTables,
    ): Promise<string | null> => '/out/prisma.svg',
  );

  undecideScreening = vi.fn(async (articleIds: number[], stage: ScreeningStage): Promise<number> => {
    this.screeningDecisions = this.screeningDecisions.filter(
      (d) => !(articleIds.includes(d.article_id) && d.stage === stage),
    );
    return articleIds.length;
  });

  reviewInvestigationResult = vi.fn(
    async (resultId: number, review: ResultReview): Promise<InvestigationResult> =>
      ({ id: resultId, review_status: review.status, reviewed_answer: review.answer ?? null }) as InvestigationResult,
  );

  getInvestigationResultsByArticle = vi.fn(
    async (_investigationId: number, _articleId: number): Promise<InvestigationResult[]> => [],
  );

  // ── Categories ──────────────────────────────────────────────────────
  getProjectCategories = vi.fn(async (_projectId: number): Promise<ProjectCategory[]> => []);

  applyCategorySet = vi.fn(
    async (_projectId: number, entries: CategorySetEntry[]): Promise<CategorySetResult> => ({
      created: entries.map((e) => e.name),
      skipped: [],
    }),
  );

  readCategorySetFile = vi.fn(async (): Promise<CategorySetEntry[] | null> => null);

  createProjectCategory = vi.fn(
    async (_projectId: number, _name: string, _type: string, _options?: CategoryOption[] | null): Promise<number> => 0,
  );

  updateProjectCategory = vi.fn(
    async (_categoryId: number, _name: string, _type: string, _options?: CategoryOption[] | null): Promise<void> =>
      undefined,
  );

  deleteProjectCategory = vi.fn(async (_categoryId: number): Promise<void> => undefined);

  getArticleCategories = vi.fn(async (_articleId: number): Promise<ArticleCategory[]> => []);

  setArticleCategory = vi.fn(
    async (_articleId: number, _categoryId: number, _value: string | null): Promise<void> => undefined,
  );

  getAllProjectArticleCategories = vi.fn(async (_projectId: number): Promise<ArticleCategory[]> => []);

  // ── Sync ────────────────────────────────────────────────────────────
  exportProject = vi.fn(async (_projectId: number): Promise<string | null> => null);

  importProject = vi.fn(async (_filePath?: string): Promise<number | null> => null);

  // ── Question Sets ─────────────────────────────────────────────────
  getQuestionSets = vi.fn(async (_projectId: number | null): Promise<QuestionSet[]> => []);

  getQuestionSet = vi.fn(async (id: number): Promise<QuestionSet> => storedQuestionSet({ id }));

  createQuestionSet = vi.fn(
    async (data: QuestionSetInput): Promise<QuestionSet> => storedQuestionSet({ id: 1, ...data }),
  );

  updateQuestionSet = vi.fn(
    async (_id: number, _data: Partial<Omit<QuestionSetInput, 'project_id'>>): Promise<void> => undefined,
  );

  deleteQuestionSet = vi.fn(async (_id: number): Promise<void> => undefined);

  duplicateQuestionSet = vi.fn(async (_id: number, _projectId: number | null): Promise<number> => 2);

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

  // ── Updates & Contingencies ─────────────────────────────────────────
  getUpdateStatus = vi.fn(
    async (): Promise<UpdateStatusResponse> => ({
      status: 'idle',
      updateInfo: null,
      downloadProgress: null,
      error: null,
      state: null,
    }),
  );
  checkForUpdates = vi.fn(async (): Promise<UpdateInfoPayload | null> => null);
  downloadUpdate = vi.fn(async (): Promise<void> => {});
  installUpdate = vi.fn(async (): Promise<void> => {});
  restoreUpdateSnapshot = vi.fn(async (): Promise<void> => undefined);
  onUpdateStatusChange = vi.fn((_callback: (status: UpdateStatusResponse) => void) => () => {});
  onUpdateDownloadProgress = vi.fn((_callback: (progress: DownloadProgressPayload) => void) => () => {});

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

function storedQuestionSet(fields: Partial<QuestionSetInput> & { id: number }): QuestionSet {
  return {
    project_id: null,
    name: '',
    questions: '[]',
    created_at: '',
    updated_at: '',
    ...fields,
    description: fields.description ?? null,
  };
}
