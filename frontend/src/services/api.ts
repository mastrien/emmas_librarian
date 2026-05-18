import axios from 'axios';
import { Project, QueryBlock, Article } from '../types';

const API_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

export const projectService = {
  async getProjects(): Promise<Project[]> {
    const response = await api.get('/projects');
    return response.data;
  },

  async createProject(name: string): Promise<Project> {
    const response = await api.post('/projects', { name });
    return response.data;
  },

  async getProject(projectId: number): Promise<Project> {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },

  async searchAndPersist(projectId: number, queryBlocks: QueryBlock[], limit: number = 100): Promise<{ count: number }> {
    const response = await api.post(`/projects/${projectId}/search`, {
      query_blocks: queryBlocks,
      limit
    });
    return response.data;
  },

  async getArticles(projectId: number): Promise<Article[]> {
    const response = await api.get(`/projects/${projectId}/articles`);
    return response.data;
  },

  getExportUrl(projectId: number): string {
    return `${API_URL}/projects/${projectId}/export`;
  },

  async getArticle(articleId: number): Promise<Article> {
    const response = await api.get(`/articles/${articleId}`);
    return response.data;
  },

  async getHighlights(articleId: number): Promise<Highlight[]> {
    const response = await api.get(`/articles/${articleId}/highlights`);
    return response.data;
  },

  async createHighlight(articleId: number, color: string, positionData: any, annotationContent?: string): Promise<{ id: number; annotation_id: number | null }> {
    const response = await api.post(`/articles/${articleId}/highlights`, {
      color,
      position_data: positionData,
      annotation_content: annotationContent
    });
    return response.data;
  },

  async getAnnotations(articleId: number): Promise<Annotation[]> {
    const response = await api.get(`/articles/${articleId}/annotations`);
    return response.data;
  },

  async uploadPdf(articleId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/articles/${articleId}/upload-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  getPdfUrl(articleId: number): string {
    return `${API_URL}/articles/${articleId}/pdf`;
  }
};
