import { ipcMain, app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { IpcChannel } from '../types';
import { QueryBlock } from '../services/types';

export function setupIpcHandlers() {
  const dbPath = path.join(app.getPath('userData'), 'emma.db');
  const db = new DatabaseManager(dbPath);
  const translator = new QueryTranslator();
  const api = new ApiIntegrator();
  const orchestrator = new SearchOrchestrator(db, translator, api);

  // Projects
  ipcMain.handle(IpcChannel.PROJECTS_GET_ALL, () => {
    return db.getAllProjects();
  });

  ipcMain.handle(IpcChannel.PROJECTS_CREATE, (event, name: string) => {
    return db.createProject(name);
  });

  ipcMain.handle(IpcChannel.PROJECTS_GET_ONE, (event, id: number) => {
    return db.getProject(id);
  });

  // Search
  ipcMain.handle(IpcChannel.SEARCH_EXECUTE, async (event, projectId: number, queryBlocks: QueryBlock[], limit?: number) => {
    return await orchestrator.executeSearch(projectId, queryBlocks, limit);
  });

  // Articles
  ipcMain.handle(IpcChannel.ARTICLES_GET_BY_PROJECT, (event, projectId: number) => {
    return db.getArticlesByProject(projectId);
  });

  ipcMain.handle(IpcChannel.ARTICLES_GET_ONE, (event, id: number) => {
    return db.getArticle(id);
  });

  ipcMain.handle(IpcChannel.ARTICLES_UPDATE_STATUS, (event, id: number, status: 'new' | 'read' | 'archived', note?: string) => {
    return db.updateArticleStatus(id, status, note);
  });

  // Annotations
  ipcMain.handle(IpcChannel.ANNOTATIONS_GET, (event, articleId: number) => {
    return db.getAnnotations(articleId);
  });

  ipcMain.handle(IpcChannel.ANNOTATIONS_CREATE, (event, articleId: number, content: string) => {
    return db.saveAnnotation(articleId, content);
  });

  ipcMain.handle(IpcChannel.ANNOTATIONS_UPDATE, (event, id: number, content: string) => {
    return db.updateAnnotation(id, content);
  });

  ipcMain.handle(IpcChannel.ANNOTATIONS_DELETE, (event, id: number) => {
    return db.deleteAnnotation(id);
  });

  // Highlights
  ipcMain.handle(IpcChannel.HIGHLIGHTS_GET, (event, articleId: number) => {
    return db.getHighlights(articleId);
  });

  ipcMain.handle(IpcChannel.HIGHLIGHTS_CREATE, (event, articleId: number, color: string, positionData: string, content?: string) => {
    let annId;
    if (content) {
      annId = db.saveAnnotation(articleId, content);
    }
    return db.saveHighlight(articleId, color, positionData, annId);
  });

  ipcMain.handle(IpcChannel.HIGHLIGHTS_DELETE, (event, id: number) => {
    return db.deleteHighlight(id);
  });

  // PDF
  ipcMain.handle(IpcChannel.PDF_UPLOAD, async (event, articleId: number, sourceFilePath: string) => {
    const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const destPath = path.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
    fs.copyFileSync(sourceFilePath, destPath);
    db.updateArticleFilePath(articleId, destPath);
    return destPath;
  });

  ipcMain.handle(IpcChannel.PDF_GET, async (event, articleId: number) => {
    const article = db.getArticle(articleId);
    if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
      throw new Error("PDF not found");
    }
    const buffer = fs.readFileSync(article.local_file_path);
    return buffer;
  });

  // CSV Export
  ipcMain.handle(IpcChannel.EXPORT_CSV, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    
    if (!project) throw new Error("Project not found");

    const header = ["id", "doi", "title", "authors", "year", "source", "status"];
    const rows = articles.map(a => [
      a.id,
      a.doi || '',
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${(a.authors || '').replace(/"/g, '""')}"`,
      a.year || '',
      `"${(a.source_databases || '').replace(/"/g, '""')}"`,
      a.status
    ]);
    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Articles CSV',
      defaultPath: `project_${projectId}_export.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, csvContent);
      return filePath;
    }
    return null;
  });

  // Dialog for file open
  ipcMain.handle(IpcChannel.DIALOG_OPEN_FILE, async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (!canceled && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  });
}
