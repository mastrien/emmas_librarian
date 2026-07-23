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
  ProjectCategory,
  ArticleCategory,
  AIModelConfig,
  AISkill,
  AIProvider,
} from '../types';
import { parseIpcError } from '../utils/AppError';

async function safeInvoke(channel: IpcChannel, ...args: any[]): Promise<any> {
  try {
    return await window.electronAPI.invoke(channel, ...args);
  } catch (error) {
    throw parseIpcError(error);
  }
}

export const projectService = {
  async getProjects(): Promise<Project[]> {
    return (await safeInvoke(IpcChannel.PROJECTS_GET_ALL)) as any;
  },

  async createProject(name: string): Promise<Project> {
    return (await safeInvoke(IpcChannel.PROJECTS_CREATE, name)) as any;
  },

  async getProject(projectId: number): Promise<Project> {
    return (await safeInvoke(IpcChannel.PROJECTS_GET_ONE, projectId)) as any;
  },

  async updateProject(id: number, name: string): Promise<void> {
    await safeInvoke(IpcChannel.PROJECTS_UPDATE, id, name);
  },

  async getProjectWritingPad(id: number): Promise<string | null> {
    return (await safeInvoke(IpcChannel.PROJECTS_GET_WRITING_PAD, id)) as any;
  },

  async updateProjectWritingPad(id: number, content: string): Promise<void> {
    return (await safeInvoke(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, id, content)) as any;
  },

  async deleteProject(id: number): Promise<void> {
    await safeInvoke(IpcChannel.PROJECTS_DELETE, id);
  },

  async getSearchHistory(projectId: number): Promise<unknown[]> {
    return (await safeInvoke(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, projectId)) as any;
  },

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
    return (await safeInvoke(IpcChannel.SEARCH_EXECUTE, projectId, queryMap, limit, sortBy, unifiedQuery)) as any;
  },

  async translateQuery(ast: QueryASTNode): Promise<DatabaseTranslationMap> {
    return (await safeInvoke(IpcChannel.SEARCH_TRANSLATE_QUERY, ast)) as any;
  },

  async getArticles(projectId: number): Promise<Article[]> {
    return (await safeInvoke(IpcChannel.ARTICLES_GET_BY_PROJECT, projectId)) as any;
  },

  async exportCsv(projectId: number): Promise<string | null> {
    return (await safeInvoke(IpcChannel.EXPORT_CSV, projectId)) as any;
  },

  async exportXlsx(projectId: number): Promise<string | null> {
    return (await safeInvoke(IpcChannel.EXPORT_XLSX, projectId)) as any;
  },

  async exportBiblioshiny(projectId: number): Promise<string | null> {
    return (await safeInvoke(IpcChannel.EXPORT_BIBLIOSHINY, projectId)) as any;
  },

  async getArticle(articleId: number): Promise<Article> {
    return (await safeInvoke(IpcChannel.ARTICLES_GET_ONE, articleId)) as any;
  },

  async updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', note?: string): Promise<void> {
    await safeInvoke(IpcChannel.ARTICLES_UPDATE_STATUS, articleId, status, note);
  },

  async updateArticleMetadata(articleId: number, data: Partial<Article>): Promise<void> {
    await safeInvoke(IpcChannel.ARTICLES_UPDATE_METADATA, articleId, data);
  },

  async getHighlights(articleId: number): Promise<Highlight[]> {
    const dbHighlights = await safeInvoke(IpcChannel.HIGHLIGHTS_GET, articleId);
    return (dbHighlights as unknown as any[]).map((h: any) => ({
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
    const id = await safeInvoke(
      IpcChannel.HIGHLIGHTS_CREATE,
      articleId,
      color,
      positionDataStr,
      contentText,
      annotationContent,
    );
    return { id, annotation_id: annotationContent ? -1 : null };
  },

  async getAnnotations(articleId: number): Promise<Annotation[]> {
    return (await safeInvoke(IpcChannel.ANNOTATIONS_GET, articleId)) as any;
  },

  async createAnnotation(articleId: number, content: string): Promise<{ id: number }> {
    const id = await safeInvoke(IpcChannel.ANNOTATIONS_CREATE, articleId, content);
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

  async getSetting(key: string): Promise<string | null> {
    return (await safeInvoke(IpcChannel.SETTINGS_GET, key)) as any;
  },

  async setSetting(key: string, value: string): Promise<void> {
    await safeInvoke(IpcChannel.SETTINGS_SET, key, value);
  },

  async getAiModelConfigs(): Promise<AIModelConfig[]> {
    return (await safeInvoke(IpcChannel.AI_MODEL_CONFIG_GET_ALL)) as any;
  },

  async updateAiModelConfig(skill: AISkill, provider: AIProvider, modelName: string): Promise<void> {
    await safeInvoke(IpcChannel.AI_MODEL_CONFIG_UPDATE, skill, provider, modelName);
  },

  async restoreAiModelConfigDefaults(): Promise<void> {
    await safeInvoke(IpcChannel.AI_MODEL_CONFIG_RESTORE);
  },

  async openPdfDialog(): Promise<string | null> {
    return (await safeInvoke(IpcChannel.DIALOG_OPEN_FILE)) as any;
  },

  async openMultiplePdfsDialog(): Promise<string[]> {
    return (await safeInvoke(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES)) as any;
  },

  async saveExportedFile(content: string, defaultPath: string): Promise<boolean> {
    return (await safeInvoke(IpcChannel.DIALOG_SAVE_FILE, content, defaultPath)) as any;
  },

  async uploadPdf(articleId: number, filePath: string): Promise<string> {
    return (await safeInvoke(IpcChannel.PDF_UPLOAD, articleId, filePath)) as any;
  },

  async unlinkPdf(articleId: number): Promise<void> {
    await safeInvoke(IpcChannel.PDF_UNLINK, articleId);
  },

  async createManualArticle(projectId: number, data: Partial<Article>, sourceFilePath?: string): Promise<number> {
    return (await safeInvoke(IpcChannel.ARTICLES_CREATE_MANUAL, projectId, data, sourceFilePath)) as any;
  },

  async createArticlesFromPdfs(projectId: number, filePaths: string[]): Promise<number> {
    return (await safeInvoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, projectId, filePaths)) as any;
  },

  async getPdfBuffer(articleId: number): Promise<ArrayBuffer> {
    return (await safeInvoke(IpcChannel.PDF_GET, articleId)) as any;
  },

  async getStoredPdfs(): Promise<any[]> {
    return (await safeInvoke(IpcChannel.PDF_LIBRARY_LIST)) as any;
  },

  async deletePdfLibraryRecord(filePath: string): Promise<number[]> {
    return (await safeInvoke(IpcChannel.PDF_LIBRARY_DELETE, filePath)) as any;
  },

  async linkPdfToArticle(articleId: number, filePath: string): Promise<void> {
    await safeInvoke(IpcChannel.PDF_LIBRARY_LINK, articleId, filePath);
  },

  async uploadPdfToLibrary(filePath: string): Promise<string> {
    return (await safeInvoke(IpcChannel.PDF_LIBRARY_UPLOAD, filePath)) as any;
  },

  async importArticlesFromProject(sourceProjectId: number, destProjectId: number, articleIds: number[]): Promise<number> {
    return (await safeInvoke(IpcChannel.ARTICLES_IMPORT_FROM_PROJECT, sourceProjectId, destProjectId, articleIds)) as any;
  },

  // Project Documents
  async openProjectDocument(url?: string, localFilePath?: string): Promise<void> {
    await safeInvoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, url, localFilePath);
  },

  // Diary
  async getDiaryEntries(projectId: number): Promise<unknown[]> {
    return (await safeInvoke(IpcChannel.DIARY_GET_ALL, projectId)) as any;
  },

  async getDiaryEntry(projectId: number, entryDate: string): Promise<DiaryEntry | null> {
    return (await safeInvoke(IpcChannel.DIARY_GET_ONE, projectId, entryDate)) as any;
  },

  async saveDiaryEntry(projectId: number, entryDate: string, content: string): Promise<void> {
    await safeInvoke(IpcChannel.DIARY_SAVE, projectId, entryDate, content);
  },

  async deleteDiaryEntry(projectId: number, entryDate: string): Promise<void> {
    await safeInvoke(IpcChannel.DIARY_DELETE, projectId, entryDate);
  },

  async getTrashItems(): Promise<any[]> {
    return (await safeInvoke(IpcChannel.TRASH_GET_ITEMS)) as any;
  },

  async restoreTrashItem(type: 'project' | 'article' | 'annotation', id: number): Promise<void> {
    await safeInvoke(IpcChannel.TRASH_RESTORE_ITEM, type, id);
  },

  async deleteTrashItemPermanent(type: 'project' | 'article' | 'annotation', id: number): Promise<void> {
    await safeInvoke(IpcChannel.TRASH_PERMANENT_DELETE, type, id);
  },

  async emptyTrash(): Promise<void> {
    await safeInvoke(IpcChannel.TRASH_EMPTY);
  },

  async getDiaryEntryHistory(projectId: number, entryDate: string): Promise<any[]> {
    return (await safeInvoke(IpcChannel.DIARY_GET_HISTORY, projectId, entryDate)) as any;
  },

  async restoreDiaryEntryVersion(versionId: number): Promise<void> {
    await safeInvoke(IpcChannel.DIARY_RESTORE_VERSION, versionId);
  },

  async exportBackup(): Promise<string | null> {
    return (await safeInvoke(IpcChannel.BACKUP_EXPORT)) as any;
  },

  async restoreBackupOverride(): Promise<boolean> {
    return (await safeInvoke(IpcChannel.BACKUP_RESTORE_OVERRIDE)) as any;
  },

  async restoreBackupMerge(): Promise<number> {
    return (await safeInvoke(IpcChannel.BACKUP_RESTORE_MERGE)) as any;
  },

  async listAutoBackups(): Promise<{ filename: string; date: string; sizeBytes: number }[]> {
    return (await safeInvoke(IpcChannel.BACKUP_LIST_AUTO)) as any;
  },

  async restoreAutoBackup(filename: string): Promise<boolean> {
    return (await safeInvoke(IpcChannel.BACKUP_RESTORE_AUTO, filename)) as any;
  },

  async getAppVersion(): Promise<string> {
    return (await safeInvoke(IpcChannel.APP_GET_VERSION)) as any;
  },

  // AI
  async generateSummary(articleId: number): Promise<{ generalSummary: string; sectionSummary: string }> {
    return (await safeInvoke(IpcChannel.AI_GENERATE_SUMMARY, articleId)) as any;
  },

  async massiveExtraction(
    articleId: number,
    questions: string[],
  ): Promise<Array<{ question: string; answer: string; quote: string | null }>> {
    return (await safeInvoke(IpcChannel.AI_MASSIVE_EXTRACTION, articleId, questions)) as any;
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
    return (await safeInvoke(IpcChannel.AI_EXTRACT_METADATA, articleId)) as any;
  },

  async getPendingHighlights(articleId: number): Promise<PendingHighlight[]> {
    return (await safeInvoke(IpcChannel.PENDING_HIGHLIGHTS_GET, articleId)) as any;
  },

  async deletePendingHighlight(id: number): Promise<void> {
    await safeInvoke(IpcChannel.PENDING_HIGHLIGHTS_DELETE, id);
  },

  // Project Documents
  async getProjectDocuments(projectId: number): Promise<ProjectDocument[]> {
    return (await safeInvoke(IpcChannel.PROJECT_DOCUMENTS_GET, projectId)) as any;
  },

  async createProjectDocument(
    projectId: number,
    title: string,
    url?: string,
    sourceFilePath?: string,
    category?: string,
  ): Promise<number> {
    return (await safeInvoke(
      IpcChannel.PROJECT_DOCUMENTS_CREATE,
      projectId,
      title,
      url ?? null,
      sourceFilePath ?? null,
      category ?? null,
    )) as any;
  },

  async updateProjectDocument(
    id: number,
    title: string,
    url?: string,
    sourceFilePath?: string,
    category?: string,
  ): Promise<void> {
    // Electron IPC drops trailing undefined args — use null to keep arg positions
    await safeInvoke(IpcChannel.PROJECT_DOCUMENTS_UPDATE, id, title, url ?? null, sourceFilePath ?? null, category ?? null);
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
  async getMassiveInvestigations(projectId: number): Promise<MassiveInvestigation[]> {
    return (await safeInvoke(IpcChannel.MASSIVE_INVESTIGATIONS_GET, projectId)) as any;
  },

  async saveMassiveInvestigation(
    projectId: number,
    questions: string[],
    articlesIds: number[],
    modelUsed: string,
    status: string,
  ): Promise<number> {
    return (await safeInvoke(
      IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
      projectId,
      questions,
      articlesIds,
      modelUsed,
      status,
    )) as any;
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
  async getInvestigationResults(investigationId: number): Promise<InvestigationResult[]> {
    return (await safeInvoke(IpcChannel.INVESTIGATION_RESULTS_GET, investigationId)) as InvestigationResult[];
  },
  async getInvestigationResultsByArticle(investigationId: number, articleId: number): Promise<InvestigationResult[]> {
    return (await safeInvoke(
      IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE,
      investigationId,
      articleId,
    )) as InvestigationResult[];
  },

  // Categories
  async getProjectCategories(projectId: number): Promise<any[]> {
    return (await safeInvoke(IpcChannel.CATEGORIES_GET_PROJECT, projectId)) as any;
  },

  async createProjectCategory(projectId: number, name: string, type: string, options?: any): Promise<number> {
    return (await safeInvoke(IpcChannel.CATEGORIES_CREATE_PROJECT, projectId, name, type, options)) as any;
  },

  async updateProjectCategory(categoryId: number, name: string, type: string, options?: any): Promise<void> {
    await safeInvoke(IpcChannel.CATEGORIES_UPDATE_PROJECT, categoryId, name, type, options);
  },

  async deleteProjectCategory(categoryId: number): Promise<void> {
    await safeInvoke(IpcChannel.CATEGORIES_DELETE_PROJECT, categoryId);
  },

  async getArticleCategories(articleId: number): Promise<any[]> {
    return (await safeInvoke(IpcChannel.CATEGORIES_GET_ARTICLE, articleId)) as any;
  },

  async setArticleCategory(articleId: number, categoryId: number, value: string | null): Promise<void> {
    await safeInvoke(IpcChannel.CATEGORIES_SET_ARTICLE, articleId, categoryId, value);
  },

  async getAllProjectArticleCategories(projectId: number): Promise<any[]> {
    return (await safeInvoke(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, projectId)) as any;
  },

  // Question Sets
  async getQuestionSets(projectId: number | null): Promise<any[]> {
    return (await safeInvoke(IpcChannel.QUESTION_SETS_LIST, projectId === undefined ? null : projectId)) as any;
  },
  async getQuestionSet(id: number): Promise<any> {
    return (await safeInvoke(IpcChannel.QUESTION_SETS_GET, id)) as any;
  },
  async createQuestionSet(data: any): Promise<any> {
    return (await safeInvoke(IpcChannel.QUESTION_SETS_CREATE, data)) as any;
  },
  async updateQuestionSet(id: number, data: any): Promise<void> {
    await safeInvoke(IpcChannel.QUESTION_SETS_UPDATE, id, data);
  },
  async deleteQuestionSet(id: number): Promise<void> {
    await safeInvoke(IpcChannel.QUESTION_SETS_DELETE, id);
  },
  async duplicateQuestionSet(id: number, projectId: number | null): Promise<number> {
    return (await safeInvoke(
      IpcChannel.QUESTION_SETS_DUPLICATE,
      id,
      projectId === undefined ? null : projectId,
    )) as any;
  },

  // Sync
  async exportProject(projectId: number): Promise<string | null> {
    return (await safeInvoke(IpcChannel.SYNC_EXPORT_PROJECT, projectId)) as any;
  },

  async importProject(filePath?: string): Promise<number | null> {
    return (await safeInvoke(IpcChannel.SYNC_IMPORT_PROJECT, filePath)) as any;
  },

  // Agenda / Scientific Venues
  async getScientificVenues(): Promise<any[]> {
    return (await safeInvoke(IpcChannel.SCIENTIFIC_VENUES_GET_ALL)) as any[];
  },
  async createScientificVenue(venueData: any): Promise<any> {
    return (await safeInvoke(IpcChannel.SCIENTIFIC_VENUE_CREATE, venueData)) as any;
  },
  async updateScientificVenue(id: number, venueData: any): Promise<any> {
    return (await safeInvoke(IpcChannel.SCIENTIFIC_VENUE_UPDATE, { id, venueData })) as any;
  },
  async deleteScientificVenue(id: number): Promise<boolean> {
    return (await safeInvoke(IpcChannel.SCIENTIFIC_VENUE_DELETE, id)) as boolean;
  },
  async toggleMilestoneStatus(milestoneId: number, status: any): Promise<boolean> {
    return (await safeInvoke(IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS, { milestoneId, status })) as boolean;
  },
};
