import type { Project, QueryBlock, Article, Highlight, Annotation } from '../types';
import { IpcChannel } from '../types';

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

  async searchAndPersist(projectId: number, queryBlocks: QueryBlock[], limit: number = 100): Promise<{ count: number }> {
    const res = await window.electronAPI.invoke(IpcChannel.SEARCH_EXECUTE, projectId, queryBlocks, limit);
    return { count: res.savedCount };
  },

  async getArticles(projectId: number): Promise<Article[]> {
    return await window.electronAPI.invoke(IpcChannel.ARTICLES_GET_BY_PROJECT, projectId);
  },

  async exportCsv(projectId: number): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.EXPORT_CSV, projectId);
  },

  async getArticle(articleId: number): Promise<Article> {
    return await window.electronAPI.invoke(IpcChannel.ARTICLES_GET_ONE, articleId);
  },

  async updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', note?: string): Promise<void> {
    await window.electronAPI.invoke(IpcChannel.ARTICLES_UPDATE_STATUS, articleId, status, note);
  },

  async getHighlights(articleId: number): Promise<Highlight[]> {
    const dbHighlights = await window.electronAPI.invoke(IpcChannel.HIGHLIGHTS_GET, articleId);
    return dbHighlights.map((h: any) => ({
      id: String(h.id),
      article_id: h.article_id,
      color: h.color,
      position_data: JSON.parse(h.position_data),
      annotation_id: h.annotation_id,
      comment: h.comment
    }));
  },

  async createHighlight(articleId: number, color: string, positionData: any, annotationContent?: string): Promise<{ id: number; annotation_id: number | null }> {
    const positionDataStr = JSON.stringify(positionData);
    const id = await window.electronAPI.invoke(IpcChannel.HIGHLIGHTS_CREATE, articleId, color, positionDataStr, annotationContent);
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

  async openPdfDialog(): Promise<string | null> {
    return await window.electronAPI.invoke(IpcChannel.DIALOG_OPEN_FILE);
  },

  async uploadPdf(articleId: number, filePath: string): Promise<string> {
    return await window.electronAPI.invoke(IpcChannel.PDF_UPLOAD, articleId, filePath);
  },

  async getPdfBuffer(articleId: number): Promise<ArrayBuffer> {
    return await window.electronAPI.invoke(IpcChannel.PDF_GET, articleId);
  }
};
