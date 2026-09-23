import {
  IpcChannel,
  type Project,
  type Article,
  type Highlight,
  type Annotation,
  type DiaryEntry,
  type PendingHighlight,
  type ProjectDocument,
  type MassiveInvestigation,
  type InvestigationResult,
  type QueryASTNode,
  type DatabaseTranslationMap,
  type SearchHistoryItem,
  ProjectCategory,
  ArticleCategory,
  AIModelConfig,
  AISkill,
  AIProvider,
} from '../types';
import { parseIpcError } from '../utils/AppError';
import type { IProjectService } from './ProjectServiceInterface';

// Highlights are stored with a numeric id and JSON-encoded position; the UI works with string ids and objects.
interface HighlightRow {
  id: number;
  article_id: number;
  color: string;
  position_data: string;
  content_text: string | null;
  annotation_id: number | null;
  comment?: string;
}

async function safeInvoke<TResponse = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<TResponse> {
  try {
    return (await window.electronAPI.invoke(channel, ...args)) as TResponse;
  } catch (error) {
    throw parseIpcError(error);
  }
}

export const projectService: IProjectService = {
  getProjects: (): Promise<Project[]> => safeInvoke<Project[]>(IpcChannel.PROJECTS_GET_ALL),

  createProject: (name: string): Promise<Project> => safeInvoke<Project>(IpcChannel.PROJECTS_CREATE, name),

  getProject: (projectId: number): Promise<Project> => safeInvoke<Project>(IpcChannel.PROJECTS_GET_ONE, projectId),

  async updateProject(id: number, name: string): Promise<void> {
    await safeInvoke(IpcChannel.PROJECTS_UPDATE, id, name);
  },

  getProjectWritingPad: (id: number): Promise<string | null> => safeInvoke(IpcChannel.PROJECTS_GET_WRITING_PAD, id),

  updateProjectWritingPad: (id: number, content: string): Promise<void> =>
    safeInvoke(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, id, content),

  async deleteProject(id: number): Promise<void> {
    await safeInvoke(IpcChannel.PROJECTS_DELETE, id);
  },

  getSearchHistory: (projectId: number): Promise<SearchHistoryItem[]> =>
    safeInvoke(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, projectId),

  async revertSearch(searchId: number): Promise<void> {
    await safeInvoke(IpcChannel.SEARCH_REVERT, searchId);
  },

  async searchAndPersist(
    projectId: number,
    queryMap: Record<string, string>,
    limit: number,
    sortBy: string,
    unifiedQuery: string,
  ): Promise<{ savedCount: number; breakdown: Record<string, { count: number; error?: string }> }> {
    return safeInvoke(IpcChannel.SEARCH_EXECUTE, projectId, queryMap, limit, sortBy, unifiedQuery);
  },

  translateQuery: (ast: QueryASTNode): Promise<DatabaseTranslationMap> =>
    safeInvoke(IpcChannel.SEARCH_TRANSLATE_QUERY, ast),

  getArticles: (projectId: number): Promise<Article[]> => safeInvoke(IpcChannel.ARTICLES_GET_BY_PROJECT, projectId),

  exportCsv: (projectId: number): Promise<string | null> => safeInvoke(IpcChannel.EXPORT_CSV, projectId),

  exportXlsx: (projectId: number): Promise<string | null> => safeInvoke(IpcChannel.EXPORT_XLSX, projectId),

  exportBiblioshiny: (projectId: number): Promise<string | null> =>
    safeInvoke(IpcChannel.EXPORT_BIBLIOSHINY, projectId),

  getArticle: (articleId: number): Promise<Article> => safeInvoke(IpcChannel.ARTICLES_GET_ONE, articleId),

  async updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', note?: string): Promise<void> {
    await safeInvoke(IpcChannel.ARTICLES_UPDATE_STATUS, articleId, status, note);
  },

  async updateArticleMetadata(articleId: number, data: Partial<Article>): Promise<void> {
    await safeInvoke(IpcChannel.ARTICLES_UPDATE_METADATA, articleId, data);
  },

  async getHighlights(articleId: number): Promise<Highlight[]> {
    const rows = await safeInvoke<HighlightRow[]>(IpcChannel.HIGHLIGHTS_GET, articleId);
    return rows.map((h) => ({
      id: String(h.id),
      article_id: h.article_id,
      color: h.color,
      position_data: JSON.parse(h.position_data),
      content_text: h.content_text,
      annotation_id: h.annotation_id,
      comment: h.comment,
    }));
  },

  async createHighlight(
    articleId: number,
    color: string,
    positionData: unknown,
    contentText: string | null,
    annotationContent?: string,
  ): Promise<{ id: number; annotation_id: number | null }> {
    const positionDataStr = JSON.stringify(positionData);
    const id = await safeInvoke<number>(
      IpcChannel.HIGHLIGHTS_CREATE,
      articleId,
      color,
      positionDataStr,
      contentText,
      annotationContent,
    );
    return { id, annotation_id: annotationContent ? -1 : null };
  },

  getAnnotations: (articleId: number): Promise<Annotation[]> =>
    safeInvoke<Annotation[]>(IpcChannel.ANNOTATIONS_GET, articleId),

  async createAnnotation(articleId: number, content: string): Promise<{ id: number }> {
    const id = await safeInvoke<number>(IpcChannel.ANNOTATIONS_CREATE, articleId, content);
    return { id };
  },

  async updateAnnotation(id: number, content: string): Promise<void> {
    await safeInvoke(IpcChannel.ANNOTATIONS_UPDATE, id, content);
  },

  async deleteAnnotation(id: number): Promise<void> {
    await safeInvoke(IpcChannel.ANNOTATIONS_DELETE, id);
  },

  async deleteHighlight(id: number): Promise<void> {
    await safeInvoke(IpcChannel.HIGHLIGHTS_DELETE, id);
  },

  getSetting: (key: string): Promise<string | null> => safeInvoke(IpcChannel.SETTINGS_GET, key),

  async setSetting(key: string, value: string): Promise<void> {
    await safeInvoke(IpcChannel.SETTINGS_SET, key, value);
  },

  getAiModelConfigs: (): Promise<AIModelConfig[]> => safeInvoke(IpcChannel.AI_MODEL_CONFIG_GET_ALL),

  async updateAiModelConfig(skill: AISkill, provider: AIProvider, modelName: string): Promise<void> {
    await safeInvoke(IpcChannel.AI_MODEL_CONFIG_UPDATE, skill, provider, modelName);
  },

  async restoreAiModelConfigDefaults(): Promise<void> {
    await safeInvoke(IpcChannel.AI_MODEL_CONFIG_RESTORE);
  },

  openPdfDialog: (): Promise<string | null> => safeInvoke(IpcChannel.DIALOG_OPEN_FILE),

  openMultiplePdfsDialog: (): Promise<string[]> => safeInvoke(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES),

  saveExportedFile: (content: string, defaultPath: string): Promise<boolean> =>
    safeInvoke(IpcChannel.DIALOG_SAVE_FILE, content, defaultPath),

  uploadPdf: (articleId: number, filePath: string): Promise<string> =>
    safeInvoke(IpcChannel.PDF_UPLOAD, articleId, filePath),

  async unlinkPdf(articleId: number): Promise<void> {
    await safeInvoke(IpcChannel.PDF_UNLINK, articleId);
  },

  createManualArticle: (projectId: number, data: Partial<Article>, sourceFilePath?: string): Promise<number> =>
    safeInvoke(IpcChannel.ARTICLES_CREATE_MANUAL, projectId, data, sourceFilePath),

  createArticlesFromPdfs: (projectId: number, filePaths: string[]): Promise<number> =>
    safeInvoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, projectId, filePaths),

  getPdfBuffer: (articleId: number): Promise<ArrayBuffer> => safeInvoke(IpcChannel.PDF_GET, articleId),

  getStoredPdfs: () => safeInvoke(IpcChannel.PDF_LIBRARY_LIST),

  deletePdfLibraryRecord: (filePath: string): Promise<number[]> => safeInvoke(IpcChannel.PDF_LIBRARY_DELETE, filePath),

  async linkPdfToArticle(articleId: number, filePath: string): Promise<void> {
    await safeInvoke(IpcChannel.PDF_LIBRARY_LINK, articleId, filePath);
  },

  uploadPdfToLibrary: (filePath: string): Promise<string> => safeInvoke(IpcChannel.PDF_LIBRARY_UPLOAD, filePath),

  importArticlesFromProject: (sourceProjectId: number, destProjectId: number, articleIds: number[]): Promise<number> =>
    safeInvoke(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, sourceProjectId, destProjectId, articleIds),

  // Project Documents
  async openProjectDocument(url?: string, localFilePath?: string): Promise<void> {
    await safeInvoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, url, localFilePath);
  },

  // Diary
  getDiaryEntries: (projectId: number): Promise<unknown[]> => safeInvoke(IpcChannel.DIARY_GET_ALL, projectId),

  getDiaryEntry: (projectId: number, entryDate: string): Promise<DiaryEntry | null> =>
    safeInvoke(IpcChannel.DIARY_GET_ONE, projectId, entryDate),

  async saveDiaryEntry(projectId: number, entryDate: string, content: string): Promise<void> {
    await safeInvoke(IpcChannel.DIARY_SAVE, projectId, entryDate, content);
  },

  async deleteDiaryEntry(projectId: number, entryDate: string): Promise<void> {
    await safeInvoke(IpcChannel.DIARY_DELETE, projectId, entryDate);
  },

  getTrashItems: () => safeInvoke(IpcChannel.TRASH_GET_ITEMS),

  async restoreTrashItem(type: 'project' | 'article' | 'annotation', id: number): Promise<void> {
    await safeInvoke(IpcChannel.TRASH_RESTORE_ITEM, type, id);
  },

  async deleteTrashItemPermanent(type: 'project' | 'article' | 'annotation', id: number): Promise<void> {
    await safeInvoke(IpcChannel.TRASH_PERMANENT_DELETE, type, id);
  },

  async emptyTrash(): Promise<void> {
    await safeInvoke(IpcChannel.TRASH_EMPTY);
  },

  getDiaryEntryHistory: (projectId: number, entryDate: string) =>
    safeInvoke(IpcChannel.DIARY_GET_HISTORY, projectId, entryDate),

  async restoreDiaryEntryVersion(versionId: number): Promise<void> {
    await safeInvoke(IpcChannel.DIARY_RESTORE_VERSION, versionId);
  },

  exportBackup: (): Promise<string | null> => safeInvoke(IpcChannel.BACKUP_EXPORT),

  restoreBackupOverride: (): Promise<boolean> => safeInvoke(IpcChannel.BACKUP_RESTORE_OVERRIDE),

  restoreBackupMerge: (): Promise<number> => safeInvoke(IpcChannel.BACKUP_RESTORE_MERGE),

  async listAutoBackups(): Promise<{ filename: string; date: string; sizeBytes: number }[]> {
    return safeInvoke(IpcChannel.BACKUP_LIST_AUTO);
  },

  restoreAutoBackup: (filename: string): Promise<boolean> => safeInvoke(IpcChannel.BACKUP_RESTORE_AUTO, filename),

  getAppVersion: (): Promise<string> => safeInvoke(IpcChannel.APP_GET_VERSION),

  // AI
  async generateSummary(articleId: number): Promise<{ generalSummary: string; sectionSummary: string }> {
    return safeInvoke(IpcChannel.AI_GENERATE_SUMMARY, articleId);
  },

  async massiveExtraction(
    articleId: number,
    questions: string[],
  ): Promise<Array<{ question: string; answer: string; quote: string | null }>> {
    return safeInvoke(IpcChannel.AI_MASSIVE_EXTRACTION, articleId, questions);
  },

  async extractMetadata(articleId: number): Promise<{
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
  }> {
    return safeInvoke(IpcChannel.AI_EXTRACT_METADATA, articleId);
  },

  getPendingHighlights: (articleId: number): Promise<PendingHighlight[]> =>
    safeInvoke(IpcChannel.PENDING_HIGHLIGHTS_GET, articleId),

  async deletePendingHighlight(id: number): Promise<void> {
    await safeInvoke(IpcChannel.PENDING_HIGHLIGHTS_DELETE, id);
  },

  // Project Documents
  getProjectDocuments: (projectId: number): Promise<ProjectDocument[]> =>
    safeInvoke(IpcChannel.PROJECT_DOCUMENTS_GET, projectId),

  async createProjectDocument(
    projectId: number,
    title: string,
    url?: string,
    sourceFilePath?: string,
    category?: string,
  ): Promise<number> {
    return safeInvoke(
      IpcChannel.PROJECT_DOCUMENTS_CREATE,
      projectId,
      title,
      url ?? null,
      sourceFilePath ?? null,
      category ?? null,
    );
  },

  async updateProjectDocument(
    id: number,
    title: string,
    url?: string,
    sourceFilePath?: string,
    category?: string,
  ): Promise<void> {
    // Electron IPC drops trailing undefined args — use null to keep arg positions
    await safeInvoke(
      IpcChannel.PROJECT_DOCUMENTS_UPDATE,
      id,
      title,
      url ?? null,
      sourceFilePath ?? null,
      category ?? null,
    );
  },

  async reorderProjectDocuments(projectId: number, orderedIds: number[]): Promise<void> {
    await safeInvoke(IpcChannel.PROJECT_DOCUMENTS_REORDER, projectId, orderedIds);
  },

  async deleteProjectDocument(id: number): Promise<void> {
    await safeInvoke(IpcChannel.PROJECT_DOCUMENTS_DELETE, id);
  },

  async openProjectDocumentExternal(url?: string, filePath?: string): Promise<void> {
    await safeInvoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, url, filePath);
  },

  // Massive Investigations
  getMassiveInvestigations: (projectId: number): Promise<MassiveInvestigation[]> =>
    safeInvoke(IpcChannel.MASSIVE_INVESTIGATIONS_GET, projectId),

  async saveMassiveInvestigation(
    projectId: number,
    questions: string[],
    articlesIds: number[],
    modelUsed: string,
    status: string,
  ): Promise<number> {
    return safeInvoke(IpcChannel.MASSIVE_INVESTIGATIONS_SAVE, projectId, questions, articlesIds, modelUsed, status);
  },

  // Investigation Results
  async saveInvestigationResults(
    investigationId: number,
    articleId: number,
    results: Array<{
      question: string;
      answer: string | null;
      quote: string | null;
      status: 'success' | 'error' | 'skipped';
      error_message: string | null;
    }>,
  ): Promise<void> {
    await safeInvoke(IpcChannel.INVESTIGATION_RESULTS_SAVE, investigationId, articleId, results);
  },
  getInvestigationResults: (investigationId: number): Promise<InvestigationResult[]> =>
    safeInvoke(IpcChannel.INVESTIGATION_RESULTS_GET, investigationId),
  async getInvestigationResultsByArticle(investigationId: number, articleId: number): Promise<InvestigationResult[]> {
    return safeInvoke(IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE, investigationId, articleId);
  },

  // Categories
  getProjectCategories: (projectId: number) => safeInvoke(IpcChannel.CATEGORIES_GET_PROJECT, projectId),

  createProjectCategory: (projectId: number, name: string, type: string, options?): Promise<number> =>
    safeInvoke(IpcChannel.CATEGORIES_CREATE_PROJECT, projectId, name, type, options),

  async updateProjectCategory(categoryId: number, name: string, type: string, options?): Promise<void> {
    await safeInvoke(IpcChannel.CATEGORIES_UPDATE_PROJECT, categoryId, name, type, options);
  },

  async deleteProjectCategory(categoryId: number): Promise<void> {
    await safeInvoke(IpcChannel.CATEGORIES_DELETE_PROJECT, categoryId);
  },

  getArticleCategories: (articleId: number) => safeInvoke(IpcChannel.CATEGORIES_GET_ARTICLE, articleId),

  async setArticleCategory(articleId: number, categoryId: number, value: string | null): Promise<void> {
    await safeInvoke(IpcChannel.CATEGORIES_SET_ARTICLE, articleId, categoryId, value);
  },

  getAllProjectArticleCategories: (projectId: number) =>
    safeInvoke(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, projectId),

  // Question Sets
  getQuestionSets: (projectId: number | null) =>
    safeInvoke(IpcChannel.QUESTION_SETS_LIST, projectId === undefined ? null : projectId),
  getQuestionSet: (id: number) => safeInvoke(IpcChannel.QUESTION_SETS_GET, id),
  createQuestionSet: (data) => safeInvoke(IpcChannel.QUESTION_SETS_CREATE, data),
  async updateQuestionSet(id: number, data): Promise<void> {
    await safeInvoke(IpcChannel.QUESTION_SETS_UPDATE, id, data);
  },
  async deleteQuestionSet(id: number): Promise<void> {
    await safeInvoke(IpcChannel.QUESTION_SETS_DELETE, id);
  },
  async duplicateQuestionSet(id: number, projectId: number | null): Promise<number> {
    return safeInvoke(IpcChannel.QUESTION_SETS_DUPLICATE, id, projectId === undefined ? null : projectId);
  },

  // Sync
  exportProject: (projectId: number): Promise<string | null> => safeInvoke(IpcChannel.SYNC_EXPORT_PROJECT, projectId),

  importProject: (filePath?: string): Promise<number | null> => safeInvoke(IpcChannel.SYNC_IMPORT_PROJECT, filePath),

  // Agenda / Scientific Venues
  getScientificVenues: () => safeInvoke(IpcChannel.SCIENTIFIC_VENUES_GET_ALL),
  createScientificVenue: (venueData) => safeInvoke(IpcChannel.SCIENTIFIC_VENUE_CREATE, venueData),
  updateScientificVenue: (id: number, venueData) => safeInvoke(IpcChannel.SCIENTIFIC_VENUE_UPDATE, { id, venueData }),
  deleteScientificVenue: (id: number): Promise<boolean> => safeInvoke(IpcChannel.SCIENTIFIC_VENUE_DELETE, id),
  toggleMilestoneStatus: (milestoneId: number, status): Promise<boolean> =>
    safeInvoke(IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS, { milestoneId, status }),
};
