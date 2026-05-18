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
  }
};
