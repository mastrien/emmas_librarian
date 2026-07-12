// @ts-nocheck
import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator, queryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { ExportService } from '../services/ExportService';
import { AIService } from '../services/AIService';
import { SyncService } from '../database/SyncService';
import { BackupService } from '../services/BackupService';
import { IpcChannel, QueryASTNode, Article } from '../types';
import { QueryBlock } from '../services/types';
import { setupAiIpcHandlers } from './aiIpcHandlers';

// @ts-nocheck
export function setupIpcRegistries() {
  const dbPath = path.join(app.getPath('userData'), 'emma.db');
  const db = new DatabaseAdapter(dbPath);
  const backupsDir = path.join(app.getPath('userData'), 'backups');
  const backupService = new BackupService(db, dbPath, backupsDir);
  // Run auto backup and GFS rotation asynchronously on startup
  Promise.resolve().then(async () => {
    try {
      const backupPath = await backupService.runAutoBackup();
      if (backupPath) {
        console.log(`Auto backup created successfully at: ${backupPath}`);
      }
    } catch (err) {
      console.error('Auto backup failed:', err);
    } finally {
      try {
        backupService.rotateBackups();
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
  setupAiIpcHandlers(db, aiService);
  const syncService = new SyncService(db);
  // App Window Controls
  ipcMain.handle('UPDATE_TITLE_BAR', (event, theme) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setTitleBarOverlay({
        color: theme === 'dark' ? '#0f172a' : '#f8fafc',
        symbolColor: theme === 'dark' ? '#e2e8f0' : '#334155',
      });
    }
  });
  // Projects
  ipcMain.handle(IpcChannel.PROJECTS_GET_ALL, () => {
    return db.getAllProjects();
  });
  ipcMain.handle(IpcChannel.PROJECTS_CREATE, (event, name) => {
    const existing = db.getAllProjects().find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) {
      throw new Error('Já existe um projeto com este nome.');
    }
    return db.createProject(name);
  });
  ipcMain.handle(IpcChannel.PROJECTS_GET_ONE, async (event, projectId) => {
    return db.getProject(projectId);
  });
  ipcMain.handle(IpcChannel.PROJECTS_GET_WRITING_PAD, async (event, projectId) => {
    return db.getProjectWritingPad(projectId);
  });
  ipcMain.handle(IpcChannel.PROJECTS_UPDATE_WRITING_PAD, async (event, projectId, content) => {
    return db.updateProjectWritingPad(projectId, content);
  });
  ipcMain.handle(IpcChannel.PROJECTS_GET_SEARCH_HISTORY, async (event, projectId) => {
    return db.getSearchHistory(projectId);
  });
  ipcMain.handle(IpcChannel.PROJECTS_UPDATE, async (event, id, name) => {
    return db.updateProject(id, name);
  });
  ipcMain.handle(IpcChannel.PROJECTS_DELETE, async (event, id) => {
    return db.deleteProject(id);
  });
  // Search
  ipcMain.handle(IpcChannel.SEARCH_EXECUTE, async (event, projectId, queryMap, limit, sortBy, unifiedQuery) => {
    if (process.env.E2E_MOCK_SEARCH === 'true') {
      return handleE2eMockSearch(db, projectId, queryMap, unifiedQuery);
    }
    return orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery);
  });
  ipcMain.handle(IpcChannel.SEARCH_TRANSLATE_QUERY, (event, ast) => {
    return queryTranslator.translate(ast);
  });
  ipcMain.handle(IpcChannel.SEARCH_REVERT, async (event, searchId) => {
    return db.revertSearch(searchId);
  });
  // Articles
  ipcMain.handle(IpcChannel.ARTICLES_GET_BY_PROJECT, (event, projectId) => {
    return db.getArticlesByProject(projectId);
  });
  ipcMain.handle(IpcChannel.ARTICLES_GET_ONE, (event, id) => {
    return db.getArticle(id);
  });
  ipcMain.handle(IpcChannel.ARTICLES_UPDATE_STATUS, (event, id, status, note) => {
    return db.updateArticleStatus(id, status, note);
  });
  ipcMain.handle(IpcChannel.ARTICLES_UPDATE_METADATA, (event, id, data) => {
    return db.updateArticleMetadata(id, data);
  });
  // Settings
  ipcMain.handle(IpcChannel.SETTINGS_GET, (event, key) => {
    return db.getSetting(key);
  });
  ipcMain.handle(IpcChannel.SETTINGS_SET, (event, key, value) => {
    return db.setSetting(key, value);
  });
  // Annotations
  ipcMain.handle(IpcChannel.ANNOTATIONS_GET, (event, articleId) => {
    return db.getAnnotations(articleId);
  });
  ipcMain.handle(IpcChannel.ANNOTATIONS_CREATE, (event, articleId, content) => {
    return db.saveAnnotation(articleId, content);
  });
  ipcMain.handle(IpcChannel.ANNOTATIONS_UPDATE, (event, id, content) => {
    return db.updateAnnotation(id, content);
  });
  ipcMain.handle(IpcChannel.ANNOTATIONS_DELETE, (event, id) => {
    return db.deleteAnnotation(id);
  });
  // Highlights
  ipcMain.handle(IpcChannel.HIGHLIGHTS_GET, (event, articleId) => {
    return db.getHighlights(articleId);
  });
  ipcMain.handle(IpcChannel.HIGHLIGHTS_CREATE, (event, articleId, color, positionData, contentText, content) => {
    let annId;
    if (content) {
      annId = db.saveAnnotation(articleId, content);
    }
    return db.saveHighlight(articleId, color, positionData, contentText, annId);
  });
  ipcMain.handle(IpcChannel.HIGHLIGHTS_DELETE, (event, id) => {
    return db.deleteHighlight(id);
  });
  // PDF
  ipcMain.handle(IpcChannel.PDF_UPLOAD, async (event, articleId, sourceFilePath) => {
    const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const destPath = path.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
    fs.copyFileSync(sourceFilePath, destPath);
    db.updateArticleFilePath(articleId, destPath);
    return destPath;
  });
  ipcMain.handle(IpcChannel.PDF_GET, async (event, articleId) => {
    const article = db.getArticle(articleId);
    if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
      throw new Error('PDF not found');
    }
    const buffer = fs.readFileSync(article.local_file_path);
    return buffer;
  });
  ipcMain.handle(IpcChannel.PDF_UNLINK, async (event, articleId) => {
    const article = db.getArticle(articleId);
    if (article && article.local_file_path) {
      try {
        if (fs.existsSync(article.local_file_path)) {
          fs.unlinkSync(article.local_file_path);
        }
      } catch (err) {
        console.error('Failed to delete physical PDF file:', err);
      }
      db.updateArticleFilePath(articleId, null);
    }
  });
  ipcMain.handle(IpcChannel.ARTICLES_CREATE_MANUAL, async (event, projectId, data, sourceFilePath) => {
    let searchId = undefined;
    try {
      searchId = db.saveSearchHistory(projectId, `Adição manual de artigo avulso: ${data.title}`, {}, 1, {
        Manual: { count: 1 },
      });
    } catch (err) {
      console.error('Failed to log manual article creation to search history:', err);
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
        console.error('Failed to copy PDF file for manual article:', err);
      }
    }
    return articleId;
  });
  ipcMain.handle(IpcChannel.ARTICLES_CREATE_FROM_PDFS, async (event, projectId, filePaths) => {
    let searchId = undefined;
    if (filePaths.length > 0) {
      try {
        searchId = db.saveSearchHistory(
          projectId,
          `Importação em Lote de ${filePaths.length} PDFs`,
          {},
          filePaths.length,
          { Manual: { count: filePaths.length } },
        );
      } catch (err) {
        console.error('Failed to log batch import to search history:', err);
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
        console.error('Failed to copy PDF file for batch import:', err);
      }
    }
    return addedCount;
  });
  // CSV Export
  ipcMain.handle(IpcChannel.EXPORT_CSV, async (event, projectId) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    const projectCategories = db.getProjectCategories(projectId);
    const articleCategories = db.getAllProjectArticleCategories(projectId);
    if (!project) throw new Error('Project not found');
    const csvContent = exportService.exportToCsv(articles, projectCategories, articleCategories);
    if (process.env.E2E_MOCK_SAVE_FILE_PATH) {
      fs.writeFileSync(process.env.E2E_MOCK_SAVE_FILE_PATH, csvContent);
      return process.env.E2E_MOCK_SAVE_FILE_PATH;
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Articles CSV',
      defaultPath: `project_${projectId}_export.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });
    if (!canceled && filePath) {
      fs.writeFileSync(filePath, csvContent);
      return filePath;
    }
    return null;
  });
  // XLSX Export
  ipcMain.handle(IpcChannel.EXPORT_XLSX, async (event, projectId) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    const projectCategories = db.getProjectCategories(projectId);
    const articleCategories = db.getAllProjectArticleCategories(projectId);
    if (!project) throw new Error('Project not found');
    const xlsxBuffer = exportService.exportToXlsx(articles, projectCategories, articleCategories);
    if (process.env.E2E_MOCK_SAVE_FILE_PATH) {
      fs.writeFileSync(process.env.E2E_MOCK_SAVE_FILE_PATH, xlsxBuffer);
      return process.env.E2E_MOCK_SAVE_FILE_PATH;
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Articles XLSX',
      defaultPath: `project_${projectId}_export.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (!canceled && filePath) {
      fs.writeFileSync(filePath, xlsxBuffer);
      return filePath;
    }
    return null;
  });
  // Dialog for file open
  ipcMain.handle(IpcChannel.DIALOG_OPEN_FILE, async (event) => {
    if (process.env.E2E_MOCK_OPEN_FILE) {
      return process.env.E2E_MOCK_OPEN_FILE;
    }
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (!canceled && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  });
  ipcMain.handle(IpcChannel.DIALOG_OPEN_MULTIPLE_FILES, async (event) => {
    if (process.env.E2E_MOCK_OPEN_MULTIPLE_FILES) {
      return process.env.E2E_MOCK_OPEN_MULTIPLE_FILES.split(';');
    }
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (!canceled && filePaths.length > 0) {
      return filePaths;
    }
    return [];
  });

  ipcMain.handle(IpcChannel.DIALOG_SAVE_FILE, async (event, content, defaultPath) => {
    if (process.env.E2E_MOCK_SAVE_FILE_PATH) {
      fs.writeFileSync(process.env.E2E_MOCK_SAVE_FILE_PATH, content, 'utf8');
      return true;
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultPath || 'export.csv',
    });
    if (!canceled && filePath) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  });
  // Diary
  ipcMain.handle(IpcChannel.DIARY_GET_ALL, (event, projectId) => {
    return db.getDiaryEntries(projectId);
  });
  ipcMain.handle(IpcChannel.DIARY_GET_ONE, (event, projectId, entryDate) => {
    return db.getDiaryEntry(projectId, entryDate);
  });
  ipcMain.handle(IpcChannel.DIARY_SAVE, (event, projectId, entryDate, content) => {
    return db.saveDiaryEntry(projectId, entryDate, content);
  });
  ipcMain.handle(IpcChannel.DIARY_DELETE, (event, projectId, entryDate) => {
    return db.deleteDiaryEntry(projectId, entryDate);
  });
  // Biblioshiny Export (Scopus CSV format — exact 45-column layout from real Scopus export)
  ipcMain.handle(IpcChannel.EXPORT_BIBLIOSHINY, async (event, projectId) => {
    const project = db.getProject(projectId);
    const articles = db.getArticlesByProject(projectId);
    if (!project) throw new Error('Project not found');
    const csvContent = exportService.exportToBiblioshiny(articles);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar para Biblioshiny',
      defaultPath: `${project.name}_biblioshiny.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
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

  // Pending Highlights
  ipcMain.handle(IpcChannel.PENDING_HIGHLIGHTS_GET, (event, articleId) => {
    return db.getPendingHighlights(articleId);
  });
  ipcMain.handle(IpcChannel.PENDING_HIGHLIGHTS_DELETE, (event, id) => {
    return db.deletePendingHighlight(id);
  });
  // Project Documents
  ipcMain.handle(IpcChannel.PROJECT_DOCUMENTS_GET, (event, projectId) => {
    return db.getProjectDocuments(projectId);
  });
  ipcMain.handle(IpcChannel.PROJECT_DOCUMENTS_CREATE, async (event, projectId, title, url, sourceFilePath) => {
    let destPath;
    if (sourceFilePath) {
      try {
        const docsDir = path.join(app.getPath('userData'), 'storage', 'project_documents');
        if (!fs.existsSync(docsDir)) {
          fs.mkdirSync(docsDir, { recursive: true });
        }
        destPath = path.join(docsDir, `doc_${projectId}_${Date.now()}.pdf`);
        fs.copyFileSync(sourceFilePath, destPath);
      } catch (err) {
        console.error('Failed to copy PDF file for project document:', err);
      }
    }
    return db.saveProjectDocument(projectId, title, url, destPath);
  });
  ipcMain.handle(IpcChannel.PROJECT_DOCUMENTS_DELETE, (event, id) => {
    return db.deleteProjectDocument(id);
  });
  ipcMain.handle(IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL, async (event, url, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      await shell.openPath(filePath);
    } else if (url) {
      await shell.openExternal(url);
    }
  });
  // Massive Investigations
  ipcMain.handle(IpcChannel.MASSIVE_INVESTIGATIONS_GET, (event, projectId) => {
    return db.getMassiveInvestigations(projectId);
  });
  ipcMain.handle(
    IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
    (event, projectId, questions, articlesIds, modelUsed, status) => {
      return db.saveMassiveInvestigation(projectId, questions, articlesIds, modelUsed, status);
    },
  );
  ipcMain.handle(IpcChannel.CATEGORIES_GET_PROJECT, (event, projectId) => {
    return db.getProjectCategories(projectId);
  });
  ipcMain.handle(IpcChannel.CATEGORIES_CREATE_PROJECT, (event, projectId, name, type, options) => {
    return db.createProjectCategory(projectId, name, type, options);
  });
  ipcMain.handle(IpcChannel.CATEGORIES_UPDATE_PROJECT, (event, categoryId, name, type, options) => {
    db.updateProjectCategory(categoryId, name, type, options);
    return true;
  });
  ipcMain.handle(IpcChannel.CATEGORIES_DELETE_PROJECT, (event, categoryId) => {
    db.deleteProjectCategory(categoryId);
    return true;
  });
  ipcMain.handle(IpcChannel.CATEGORIES_GET_ARTICLE, (event, articleId) => {
    return db.getArticleCategories(articleId);
  });
  ipcMain.handle(IpcChannel.CATEGORIES_SET_ARTICLE, (event, articleId, categoryId, value) => {
    db.setArticleCategory(articleId, categoryId, value);
    return true;
  });
  ipcMain.handle(IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE, (event, projectId) => {
    return db.getAllProjectArticleCategories(projectId);
  });
  // Sync
  ipcMain.handle(IpcChannel.SYNC_EXPORT_PROJECT, async (event, projectId) => {
    return await syncService.exportProject(projectId);
  });
  ipcMain.handle(IpcChannel.SYNC_IMPORT_PROJECT, async (event, filePath) => {
    return await syncService.importProject(filePath);
  });
  // Trash Bin
  ipcMain.handle(IpcChannel.TRASH_GET_ITEMS, () => {
    return db.getTrashItems();
  });
  ipcMain.handle(IpcChannel.TRASH_RESTORE_ITEM, (event, type, id) => {
    return db.restoreTrashItem(type, id);
  });
  ipcMain.handle(IpcChannel.TRASH_PERMANENT_DELETE, (event, type, id) => {
    return db.deleteTrashItemPermanent(type, id);
  });
  ipcMain.handle(IpcChannel.TRASH_EMPTY, () => {
    return db.emptyTrash();
  });
  // Diary History
  ipcMain.handle(IpcChannel.DIARY_GET_HISTORY, (event, projectId, entryDate) => {
    return db.getDiaryEntryHistory(projectId, entryDate);
  });
  ipcMain.handle(IpcChannel.DIARY_RESTORE_VERSION, (event, versionId) => {
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
    return backupService.listAutoBackups();
  });
  ipcMain.handle(IpcChannel.BACKUP_RESTORE_AUTO, (event, filename) => {
    const success = backupService.restoreAutoBackup(filename);
    if (success) {
      app.relaunch();
      app.exit(0);
    }
    return success;
  });
}

function handleE2eMockSearch(db: DatabaseAdapter, projectId: number, queryMap: any, query: string) {
  const searchId = db.saveSearchHistory(projectId, query || 'E2E mock query', queryMap, 1, { openalex: { count: 1 } });
  db.saveArticle(projectId, {
    doi: '10.1234/e2e-mock-doi',
    title: 'Aprendizado de Maquina E2E',
    authors: 'Author E2E',
    year: 2026,
    source_query: JSON.stringify(queryMap),
    source_databases: JSON.stringify(['OpenAlex']),
    csl_json: '{}',
    search_id: searchId,
  });
  return {
    savedCount: 1,
    breakdown: { openalex: { count: 1 } },
    articles: db.getArticlesByProject(projectId),
  };
}
