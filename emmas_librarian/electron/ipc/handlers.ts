import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator, queryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { ExportService } from '../services/ExportService';
import { AIService } from '../services/AIService';
import { SyncService } from '../database/SyncService';
import { BackupManager } from '../services/BackupManager';
import { IpcChannel, QueryASTNode, Article } from '../types';
import { QueryBlock } from '../services/types';

export function setupIpcHandlers() {
  const dbPath = path.join(app.getPath('userData'), 'emma.db');
  const db = new DatabaseManager(dbPath);
  const backupsDir = path.join(app.getPath('userData'), 'backups');
  const backupManager = new BackupManager(db, dbPath, backupsDir);

  // Run auto backup and GFS rotation asynchronously on startup
  Promise.resolve().then(async () => {
    try {
      const backupPath = await backupManager.runAutoBackup();
      if (backupPath) {
        console.log(`Auto backup created successfully at: ${backupPath}`);
      }
    } catch (err) {
      console.error('Auto backup failed:', err);
    } finally {
      try {
        backupManager.rotateBackups();
      } catch (err) {
        console.error('Backup rotation failed:', err);
      }
    }
  });

  const translator = new QueryTranslator();
  const api = new ApiIntegrator();
  const orchestrator = new SearchOrchestrator(db, translator, api);
  const exportService = new ExportService();
  const aiService = new AIService(db);
  const syncService = new SyncService(db);

  // App Window Controls
  ipcMain.handle('UPDATE_TITLE_BAR', (event, theme: 'light' | 'dark') => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setTitleBarOverlay({
        color: theme === 'dark' ? '#0f172a' : '#f8fafc',
        symbolColor: theme === 'dark' ? '#e2e8f0' : '#334155'
      });
    }
  });

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

  ipcMain.handle(IpcChannel.PROJECTS_GET_WRITING_PAD, async (event, projectId: number) => {
    return db.getProjectWritingPad(projectId);
  });

  ipcMain.handle(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, async (event, projectId: number, content: string) => {
    return db.updateProjectWritingPad(projectId, content);
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
    return orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy as 'relevance' | 'citations' | 'date', unifiedQuery);
  });

  ipcMain.handle(IpcChannel.SEARCH_TRANSLATE_QUERY, (event, ast: unknown) => {
    return queryTranslator.translate(ast as QueryASTNode);
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

  ipcMain.handle(IpcChannel.ARTICLES_UPDATE_METADATA, (event, id: number, data: unknown) => {
    return db.updateArticleMetadata(id, data as Partial<Article>);
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

  ipcMain.handle(IpcChannel.HIGHLIGHTS_CREATE, (event, articleId: number, color: string, positionData: string, contentText: string | null, content?: string) => {
    let annId;
    if (content) {
      annId = db.saveAnnotation(articleId, content);
    }
    return db.saveHighlight(articleId, color, positionData, contentText, annId);
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
    let searchId: number | undefined = undefined;
    try {
      searchId = db.saveSearchHistory(
        projectId,
        `Adição manual de artigo avulso: ${data.title}`,
        {},
        1,
        { "Manual": { "count": 1 } }
      );
    } catch (err) {
      console.error("Failed to log manual article creation to search history:", err);
    }

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
      search_id: searchId,
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

    return articleId;
  });

  ipcMain.handle(IpcChannel.ARTICLES_CREATE_FROM_PDFS, async (event, projectId: number, filePaths: string[]) => {
    let searchId: number | undefined = undefined;
    if (filePaths.length > 0) {
      try {
        searchId = db.saveSearchHistory(
          projectId,
          `Importação em Lote de ${filePaths.length} PDFs`,
          {},
          filePaths.length,
          { "Manual": { "count": filePaths.length } }
        );
      } catch (err) {
        console.error("Failed to log batch import to search history:", err);
      }
    }

    let addedCount = 0;
    const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }

    for (const sourceFilePath of filePaths) {
      try {
        const filename = path.basename(sourceFilePath, '.pdf');
        
        // Save the article with title = filename
        const articleId = db.saveArticle(projectId, {
          title: filename,
          authors: '',
          source_query: 'Importação em Lote',
          source_databases: JSON.stringify(['Manual']),
          csl_json: JSON.stringify({}),
          search_id: searchId,
        });

        // Copy the PDF
        const destPath = path.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
        fs.copyFileSync(sourceFilePath, destPath);
        db.updateArticleFilePath(articleId, destPath);

        addedCount++;
      } catch (err) {
        console.error("Failed to copy PDF file for batch import:", err);
      }
    }

    return addedCount;
  });

  // CSV Export
  ipcMain.handle(IpcChannel.EXPORT_CSV, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    const projectCategories = db.getProjectCategories(projectId);
    const articleCategories = db.getAllProjectArticleCategories(projectId);
    
    if (!project) throw new Error("Project not found");

    const csvContent = exportService.exportToCsv(articles, projectCategories, articleCategories);

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

  // XLSX Export
  ipcMain.handle(IpcChannel.EXPORT_XLSX, async (event, projectId: number) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    const projectCategories = db.getProjectCategories(projectId);
    const articleCategories = db.getAllProjectArticleCategories(projectId);
    
    if (!project) throw new Error("Project not found");

    const xlsxBuffer = exportService.exportToXlsx(articles, projectCategories, articleCategories);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Articles XLSX',
      defaultPath: `project_${projectId}_export.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, xlsxBuffer);
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

  ipcMain.handle(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES, async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (!canceled && filePaths.length > 0) {
      return filePaths;
    }
    return [];
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

  // App Info
  ipcMain.handle(IpcChannel.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  // AI Services
  ipcMain.handle(IpcChannel.AI_GENERATE_SUMMARY, async (event, articleId: number) => {
    const article = db.getArticle(articleId);
    if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
      throw new Error("PDF not found for this article.");
    }
    return aiService.generateSummary(articleId, article.local_file_path);
  });

  ipcMain.handle(IpcChannel.AI_MASSIVE_EXTRACTION, async (event, articleId: number, questions: string[]) => {
    const article = db.getArticle(articleId);
    if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
      throw new Error("PDF not found for this article.");
    }
    return aiService.massiveExtraction(articleId, article.local_file_path, questions);
  });

  ipcMain.handle(IpcChannel.AI_EXTRACT_METADATA, async (event, articleId: number) => {
    const article = db.getArticle(articleId);
    if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
      throw new Error("PDF not found for this article.");
    }
    return aiService.extractMetadataFromPdf(articleId, article.local_file_path);
  });

  // Pending Highlights
  ipcMain.handle(IpcChannel.PENDING_HIGHLIGHTS_GET, (event, articleId: number) => {
    return db.getPendingHighlights(articleId);
  });

  ipcMain.handle(IpcChannel.PENDING_HIGHLIGHTS_DELETE, (event, id: number) => {
    return db.deletePendingHighlight(id);
  });

  // Project Documents
  ipcMain.handle(IpcChannel.PROJECT_DOCUMENTS_GET, (event, projectId: number) => {
    return db.getProjectDocuments(projectId);
  });

  ipcMain.handle(IpcChannel.PROJECT_DOCUMENTS_CREATE, async (event, projectId: number, title: string, url?: string, sourceFilePath?: string) => {
    let destPath: string | undefined;
    if (sourceFilePath) {
      try {
        const docsDir = path.join(app.getPath('userData'), 'storage', 'project_documents');
        if (!fs.existsSync(docsDir)) {
          fs.mkdirSync(docsDir, { recursive: true });
        }
        destPath = path.join(docsDir, `doc_${projectId}_${Date.now()}.pdf`);
        fs.copyFileSync(sourceFilePath, destPath);
      } catch (err) {
        console.error("Failed to copy PDF file for project document:", err);
      }
    }
    return db.saveProjectDocument(projectId, title, url, destPath);
  });

  ipcMain.handle(IpcChannel.PROJECT_DOCUMENTS_DELETE, (event, id: number) => {
    return db.deleteProjectDocument(id);
  });

  ipcMain.handle(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, async (event, url?: string, filePath?: string) => {
    if (filePath && fs.existsSync(filePath)) {
      await shell.openPath(filePath);
    } else if (url) {
      await shell.openExternal(url);
    }
  });

  // Massive Investigations
  ipcMain.handle(IpcChannel.MASSIVE_INVESTIGATIONS_GET, (event, projectId: number) => {
    return db.getMassiveInvestigations(projectId);
  });

  ipcMain.handle(IpcChannel.MASSIVE_INVESTIGATIONS_SAVE, (event, projectId: number, questions: string[], articlesIds: number[], modelUsed: string, status: string) => {
    return db.saveMassiveInvestigation(projectId, questions, articlesIds, modelUsed, status);
  });
  ipcMain.handle(IpcChannel.CATEGORIES_GET_PROJECT, (event, projectId: number) => {
    return db.getProjectCategories(projectId);
  });

  ipcMain.handle(IpcChannel.CATEGORIES_CREATE_PROJECT, (event, projectId: number, name: string, type: string, options?: string) => {
    return db.createProjectCategory(projectId, name, type, options);
  });

  ipcMain.handle(IpcChannel.CATEGORIES_UPDATE_PROJECT, (event, categoryId: number, name: string, type: string, options?: string) => {
    db.updateProjectCategory(categoryId, name, type, options);
    return true;
  });

  ipcMain.handle(IpcChannel.CATEGORIES_DELETE_PROJECT, (event, categoryId: number) => {
    db.deleteProjectCategory(categoryId);
    return true;
  });

  ipcMain.handle(IpcChannel.CATEGORIES_GET_ARTICLE, (event, articleId: number) => {
    return db.getArticleCategories(articleId);
  });

  ipcMain.handle(IpcChannel.CATEGORIES_SET_ARTICLE, (event, articleId: number, categoryId: number, value: string | null) => {
    db.setArticleCategory(articleId, categoryId, value);
    return true;
  });

  ipcMain.handle(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, (event, projectId: number) => {
    return db.getAllProjectArticleCategories(projectId);
  });

  // Sync
  ipcMain.handle(IpcChannel.SYNC_EXPORT_PROJECT, async (event, projectId: number) => {
    return await syncService.exportProject(projectId);
  });

  ipcMain.handle(IpcChannel.SYNC_IMPORT_PROJECT, async (event, filePath?: string) => {
    return await syncService.importProject(filePath);
  });

  // Trash Bin
  ipcMain.handle(IpcChannel.TRASH_GET_ITEMS, () => {
    return db.getTrashItems();
  });

  ipcMain.handle(IpcChannel.TRASH_RESTORE_ITEM, (event, type: 'project' | 'article' | 'annotation', id: number) => {
    return db.restoreTrashItem(type, id);
  });

  ipcMain.handle(IpcChannel.TRASH_PERMANENT_DELETE, (event, type: 'project' | 'article' | 'annotation', id: number) => {
    return db.deleteTrashItemPermanent(type, id);
  });

  ipcMain.handle(IpcChannel.TRASH_EMPTY, () => {
    return db.emptyTrash();
  });

  // Diary History
  ipcMain.handle(IpcChannel.DIARY_GET_HISTORY, (event, projectId: number, entryDate: string) => {
    return db.getDiaryEntryHistory(projectId, entryDate);
  });

  ipcMain.handle(IpcChannel.DIARY_RESTORE_VERSION, (event, versionId: number) => {
    return db.restoreDiaryEntryVersion(versionId);
  });

  // Manual Backup & Restore
  ipcMain.handle(IpcChannel.BACKUP_EXPORT, () => {
    return syncService.exportBackup();
  });

  ipcMain.handle(IpcChannel.BACKUP_RESTORE_OVERRIDE, () => {
    return syncService.restoreBackupOverride();
  });

  ipcMain.handle(IpcChannel.BACKUP_RESTORE_MERGE, () => {
    return syncService.restoreBackupMerge();
  });

  ipcMain.handle(IpcChannel.BACKUP_LIST_AUTO, () => {
    return backupManager.listAutoBackups();
  });

  ipcMain.handle(IpcChannel.BACKUP_RESTORE_AUTO, (event, filename: string) => {
    const success = backupManager.restoreAutoBackup(filename);
    if (success) {
      app.relaunch();
      app.exit(0);
    }
    return success;
  });
}
