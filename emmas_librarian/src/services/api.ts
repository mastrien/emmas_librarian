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
  type QueryASTNode,
  type DatabaseTranslationMap,
} from '../types';

export const projectService = {
  async getProjects(): Promise<Project[]> {
    return await window.electronAPI.invoke(IpcChannel.PROJECTS_GET_ALL);
  },

  async createProject(name: string): Promise<Project> {
    return await window.electronAPI.invoke(IpcChannel.PROJECTS_CREATE, name);
  },

  async getProject(projectId: number): Promise<Project> {
    return await window.electronAPI.invoke(IpcChannel.PROJECTS_GET_ONE, projectId);
  },

  async updateProject(id: number, name: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PROJECTS_UPDATE, id, name);
  },

  async getProjectWritingPad(id: number): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.PROJECTS_GET_WRITING_PAD, id);
  },

  async updateProjectWritingPad(id: number, content: string): Promise<void> {
    return await window.electronAPI.invoke(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, id, content);
  },

  async deleteProject(id: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PROJECTS_DELETE, id);
  },

  async getSearchHistory(projectId: number): Promise<unknown[]> {
    return await window.electronAPI.invoke(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, projectId);
  },

  async revertSearch(searchId: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.SEARCH_REVERT, searchId);
  },

  async searchAndPersist(
    projectId: number,
    queryMap: Record<string, string>,
    limit: number,
    sortBy: string,
    unifiedQuery: string,
  ): Promise<{ savedCount: number; breakdown: Record<string, { count: number; error?: string }> }> {
    return await window.electronAPI.invoke(IpcChannel.SEARCH_EXECUTE, projectId, queryMap, limit, sortBy, unifiedQuery);
  },

  async translateQuery(ast: QueryASTNode): Promise<DatabaseTranslationMap> {
    return await window.electronAPI.invoke(IpcChannel.SEARCH_TRANSLATE_QUERY, ast);
  },

  async getArticles(projectId: number): Promise<Article[]> {
    return await window.electronAPI.invoke(IpcChannel.ARTICLES_GET_BY_PROJECT, projectId);
  },

  async exportCsv(projectId: number): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.EXPORT_CSV, projectId);
  },

  async exportXlsx(projectId: number): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.EXPORT_XLSX, projectId);
  },

  async exportBiblioshiny(projectId: number): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.EXPORT_BIBLIOSHINY, projectId);
  },

  async getArticle(articleId: number): Promise<Article> {
    return await window.electronAPI.invoke(IpcChannel.ARTICLES_GET_ONE, articleId);
  },

  async updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', note?: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.ARTICLES_UPDATE_STATUS, articleId, status, note);
  },

  async updateArticleMetadata(articleId: number, data: Partial<Article>): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.ARTICLES_UPDATE_METADATA, articleId, data);
  },

  async getHighlights(articleId: number): Promise<Highlight[]> {
    const dbHighlights = await window.electronAPI.invoke(IpcChannel.HIGHLIGHTS_GET, articleId);
    return dbHighlights.map((h: any) => ({
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
    const id = await window.electronAPI.invoke(
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
    return await window.electronAPI.invoke(IpcChannel.ANNOTATIONS_GET, articleId);
  },

  async createAnnotation(articleId: number, content: string): Promise<{ id: number }> {
    const id = await window.electronAPI.invoke(IpcChannel.ANNOTATIONS_CREATE, articleId, content);
    return { id };
  },

  async updateAnnotation(id: number, content: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.ANNOTATIONS_UPDATE, id, content);
  },

  async deleteAnnotation(id: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.ANNOTATIONS_DELETE, id);
  },

  async deleteHighlight(id: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.HIGHLIGHTS_DELETE, id);
  },

  async getSetting(key: string): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.SETTINGS_GET, key);
  },

  async setSetting(key: string, value: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.SETTINGS_SET, key, value);
  },

  async openPdfDialog(): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.DIALOG_OPEN_FILE);
  },

  async openMultiplePdfsDialog(): Promise<string[]> {
    return await window.electronAPI.invoke(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES);
  },

  async uploadPdf(articleId: number, filePath: string): Promise<string> {
    return await window.electronAPI.invoke(IpcChannel.PDF_UPLOAD, articleId, filePath);
  },

  async unlinkPdf(articleId: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PDF_UNLINK, articleId);
  },

  async createManualArticle(projectId: number, data: Partial<Article>, sourceFilePath?: string): Promise<number> {
    return await window.electronAPI.invoke(IpcChannel.ARTICLES_CREATE_MANUAL, projectId, data, sourceFilePath);
  },

  async createArticlesFromPdfs(projectId: number, filePaths: string[]): Promise<number> {
    return await window.electronAPI.invoke(IpcChannel.ARTICLES_CREATE_FROM_PDFS, projectId, filePaths);
  },

  async getPdfBuffer(articleId: number): Promise<ArrayBuffer> {
    return await window.electronAPI.invoke(IpcChannel.PDF_GET, articleId);
  },

  // Project Documents
  async openProjectDocument(url: string, localFilePath?: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, url, localFilePath);
  },

  // Diary
  async getDiaryEntries(projectId: number): Promise<DiaryEntry[]> {
    return await window.electronAPI.invoke(IpcChannel.DIARY_GET_ALL, projectId);
  },

  async getDiaryEntry(projectId: number, entryDate: string): Promise<DiaryEntry | null> {
    return await window.electronAPI.invoke(IpcChannel.DIARY_GET_ONE, projectId, entryDate);
  },

  async saveDiaryEntry(projectId: number, entryDate: string, content: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.DIARY_SAVE, projectId, entryDate, content);
  },

  async deleteDiaryEntry(projectId: number, entryDate: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.DIARY_DELETE, projectId, entryDate);
  },

  async getAppVersion(): Promise<string> {
    return await window.electronAPI.invoke(IpcChannel.APP_GET_VERSION);
  },

  // AI
  async generateSummary(articleId: number): Promise<{ generalSummary: string; sectionSummary: string }> {
    return await window.electronAPI.invoke(IpcChannel.AI_GENERATE_SUMMARY, articleId);
  },

  async massiveExtraction(
    articleId: number,
    questions: string[],
  ): Promise<Array<{ question: string; answer: string; quote: string | null }>> {
    return await window.electronAPI.invoke(IpcChannel.AI_MASSIVE_EXTRACTION, articleId, questions);
  },

  async extractMetadata(
    articleId: number,
  ): Promise<{
    authors?: string;
    year?: string;
    title?: string;
    abstract?: string;
    references_list?: string;
    error?: string;
    doi?: string;
    journal?: string;
  }> {
    return await window.electronAPI.invoke(IpcChannel.AI_EXTRACT_METADATA, articleId);
  },

  async getPendingHighlights(articleId: number): Promise<PendingHighlight[]> {
    return await window.electronAPI.invoke(IpcChannel.PENDING_HIGHLIGHTS_GET, articleId);
  },

  async deletePendingHighlight(id: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PENDING_HIGHLIGHTS_DELETE, id);
  },

  // Project Documents
  async getProjectDocuments(projectId: number): Promise<ProjectDocument[]> {
    return await window.electronAPI.invoke(IpcChannel.PROJECT_DOCUMENTS_GET, projectId);
  },

  async createProjectDocument(
    projectId: number,
    title: string,
    url?: string,
    sourceFilePath?: string,
  ): Promise<number> {
    return await window.electronAPI.invoke(IpcChannel.PROJECT_DOCUMENTS_CREATE, projectId, title, url, sourceFilePath);
  },

  async deleteProjectDocument(id: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PROJECT_DOCUMENTS_DELETE, id);
  },

  async openProjectDocumentExternal(url?: string, filePath?: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, url, filePath);
  },

  // Massive Investigations
  async getMassiveInvestigations(projectId: number): Promise<MassiveInvestigation[]> {
    return await window.electronAPI.invoke(IpcChannel.MASSIVE_INVESTIGATIONS_GET, projectId);
  },

  async saveMassiveInvestigation(
    projectId: number,
    questions: string[],
    articlesIds: number[],
    modelUsed: string,
    status: string,
  ): Promise<number> {
    return await window.electronAPI.invoke(
      IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
      projectId,
      questions,
      articlesIds,
      modelUsed,
      status,
    );
  },

  // Categories
  async getProjectCategories(projectId: number): Promise<any[]> {
    return await window.electronAPI.invoke(IpcChannel.CATEGORIES_GET_PROJECT, projectId);
  },

  async createProjectCategory(projectId: number, name: string, type: string, options?: string): Promise<number> {
    return await window.electronAPI.invoke(IpcChannel.CATEGORIES_CREATE_PROJECT, projectId, name, type, options);
  },

  async updateProjectCategory(categoryId: number, name: string, type: string, options?: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.CATEGORIES_UPDATE_PROJECT, categoryId, name, type, options);
  },

  async deleteProjectCategory(categoryId: number): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.CATEGORIES_DELETE_PROJECT, categoryId);
  },

  async getArticleCategories(articleId: number): Promise<any[]> {
    return await window.electronAPI.invoke(IpcChannel.CATEGORIES_GET_ARTICLE, articleId);
  },

  async setArticleCategory(articleId: number, categoryId: number, value: string | null): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.CATEGORIES_SET_ARTICLE, articleId, categoryId, value);
  },

  async getAllProjectArticleCategories(projectId: number): Promise<any[]> {
    return await window.electronAPI.invoke(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, projectId);
  },

  // Sync
  async exportProject(projectId: number): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.SYNC_EXPORT_PROJECT, projectId);
  },

  async importProject(filePath?: string): Promise<number | null> {
    return await window.electronAPI.invoke(IpcChannel.SYNC_IMPORT_PROJECT, filePath);
  },
};
