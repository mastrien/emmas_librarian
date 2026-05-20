import { ipcMain, app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator, queryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { ExportService } from '../services/ExportService';
import { IpcChannel } from '../types';
import { QueryBlock } from '../services/types';

export function setupIpcHandlers() {
  const dbPath = path.join(app.getPath('userData'), 'emma.db');
  const db = new DatabaseManager(dbPath);
  const translator = new QueryTranslator();
  const api = new ApiIntegrator();
  const orchestrator = new SearchOrchestrator(db, translator, api);
  const exportService = new ExportService();

  // Projects
  ipcMain.handle(IpcChannel.PROJECTS_GET_ALL, () => {
    return db.getAllProjects();
  });

  ipcMain.handle(IpcChannel.PROJECTS_CREATE, (event, name: string) => {
    return db.createProject(name);
  });

  ipcMain.handle(IpcChannel.PROJECTS_GET_ONE, async (event, projectId: number) => {
    return db.getProject(projectId);
  });

  ipcMain.handle(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, async (event, projectId: number) => {
    return db.getSearchHistory(projectId);
  });

  ipcMain.handle(IpcChannel.PROJECTS_UPDATE, async (event, id: number, name: string) => {
    return db.updateProject(id, name);
  });

  ipcMain.handle(IpcChannel.PROJECTS_DELETE, async (event, id: number) => {
    return db.deleteProject(id);
  });

  // Search
  ipcMain.handle(IpcChannel.SEARCH_EXECUTE, async (event, projectId: number, queryMap: Record<string, string>, limit: number, sortBy: string, unifiedQuery: string) => {
    return orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy as any, unifiedQuery);
  });

  ipcMain.handle(IpcChannel.SEARCH_TRANSLATE_QUERY, (event, ast: any) => {
    return queryTranslator.translate(ast);
  });

  ipcMain.handle(IpcChannel.SEARCH_REVERT, async (event, searchId: number) => {
    return db.revertSearch(searchId);
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

  // Settings
  ipcMain.handle(IpcChannel.SETTINGS_GET, (event, key: string) => {
    return db.getSetting(key);
  });

  ipcMain.handle(IpcChannel.SETTINGS_SET, (event, key: string, value: string) => {
    return db.setSetting(key, value);
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

  ipcMain.handle(IpcChannel.PDF_UNLINK, async (event, articleId: number) => {
    const article = db.getArticle(articleId);
    if (article && article.local_file_path) {
      try {
        if (fs.existsSync(article.local_file_path)) {
          fs.unlinkSync(article.local_file_path);
        }
      } catch (err) {
        console.error("Failed to delete physical PDF file:", err);
      }
      db.updateArticleFilePath(articleId, null);
    }
  });

  ipcMain.handle(IpcChannel.ARTICLES_CREATE_MANUAL, async (event, projectId: number, data: any, sourceFilePath?: string) => {
    const articleId = db.saveArticle(projectId, {
      title: data.title,
      authors: data.authors || '',
      year: data.year ? parseInt(data.year) : undefined,
      doi: data.doi || undefined,
      abstract: data.abstract || undefined,
      journal: data.journal || undefined,
      source_query: 'Manual Import',
      source_databases: JSON.stringify(['Manual']),
      csl_json: JSON.stringify({}),
    });

    if (sourceFilePath) {
      try {
        const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
        if (!fs.existsSync(pdfsDir)) {
          fs.mkdirSync(pdfsDir, { recursive: true });
        }
        const destPath = path.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
        fs.copyFileSync(sourceFilePath, destPath);
        db.updateArticleFilePath(articleId, destPath);
      } catch (err) {
        console.error("Failed to copy PDF file for manual article:", err);
      }
    }

    try {
      db.saveSearchHistory(
        projectId,
        `Adição manual de artigo avulso: ${data.title}`,
        {},
        1,
        { "Manual": { "count": 1 } }
      );
    } catch (err) {
      console.error("Failed to log manual article creation to search history:", err);
    }

    return articleId;
  });

  // CSV Export
  ipcMain.handle(IpcChannel.EXPORT_CSV, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    
    if (!project) throw new Error("Project not found");

    const csvContent = exportService.exportToCsv(articles);

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

  // Diary
  ipcMain.handle(IpcChannel.DIARY_GET_ALL, (event, projectId: number) => {
    return db.getDiaryEntries(projectId);
  });

  ipcMain.handle(IpcChannel.DIARY_GET_ONE, (event, projectId: number, entryDate: string) => {
    return db.getDiaryEntry(projectId, entryDate);
  });

  ipcMain.handle(IpcChannel.DIARY_SAVE, (event, projectId: number, entryDate: string, content: string) => {
    return db.saveDiaryEntry(projectId, entryDate, content);
  });

  ipcMain.handle(IpcChannel.DIARY_DELETE, (event, projectId: number, entryDate: string) => {
    return db.deleteDiaryEntry(projectId, entryDate);
  });

  // Biblioshiny Export (Scopus CSV format — exact 45-column layout from real Scopus export)
  ipcMain.handle(IpcChannel.EXPORT_BIBLIOSHINY, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    
    if (!project) throw new Error("Project not found");

    const csvContent = exportService.exportToBiblioshiny(articles);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar para Biblioshiny',
      defaultPath: `${project.name}_biblioshiny.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, csvContent, 'utf-8');
      return filePath;
    }
    return null;
  });
}
