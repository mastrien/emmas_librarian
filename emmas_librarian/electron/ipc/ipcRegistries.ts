import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { ScientificVenueRepository } from '../database/ScientificVenueRepository';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator, queryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { ExportService } from '../services/ExportService';
import { AIService } from '../services/AIService';
import { SyncService } from '../database/SyncService';
import { BackupService } from '../services/BackupService';
import { IpcChannel, QueryASTNode } from '../types';
import { Article } from '../../src/types';
import { QueryBlock } from '../services/types';
import { setupAiIpcHandlers } from './aiIpcHandlers';
import { withErrorHandling } from './errorHandler';

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
  ipcMain.handle(
    'UPDATE_TITLE_BAR',
    withErrorHandling(async (event, theme) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        win.setTitleBarOverlay({
          color: theme === 'dark' ? '#0f172a' : '#f8fafc',
          symbolColor: theme === 'dark' ? '#e2e8f0' : '#334155',
        });
      }
    }),
  );
  // Projects
  ipcMain.handle(
    IpcChannel.PROJECTS_GET_ALL,
    withErrorHandling(async () => {
      return db.getAllProjects();
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_CREATE,
    withErrorHandling(async (event, name) => {
      const existing = db.getAllProjects().find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (existing) {
        throw new Error(
          `[ERR_DUPLICATE_NAME] Já existe um projeto com este nome. Offending value: "${name}". Expected shape: String de nome único entre os projetos cadastrados.`
        );
      }
      return db.createProject(name);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_GET_ONE,
    withErrorHandling(async (event, projectId) => {
      return db.getProject(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_GET_WRITING_PAD,
    withErrorHandling(async (event, projectId) => {
      return db.getProjectWritingPad(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_UPDATE_WRITING_PAD,
    withErrorHandling(async (event, projectId, content) => {
      return db.updateProjectWritingPad(projectId, content);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_GET_SEARCH_HISTORY,
    withErrorHandling(async (event, projectId) => {
      return db.getSearchHistory(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_UPDATE,
    withErrorHandling(async (event, id, name) => {
      return db.updateProject(id, name);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECTS_DELETE,
    withErrorHandling(async (event, id) => {
      return db.deleteProject(id);
    }),
  );
  // Search
  ipcMain.handle(
    IpcChannel.SEARCH_EXECUTE,
    withErrorHandling(async (event, projectId, queryMap, limit, sortBy, unifiedQuery) => {
      if (process.env.E2E_MOCK_SEARCH === 'true') {
        return handleE2eMockSearch(db, projectId, queryMap, unifiedQuery);
      }
      return orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery);
    }),
  );
  ipcMain.handle(
    IpcChannel.SEARCH_TRANSLATE_QUERY,
    withErrorHandling(async (event, ast) => {
      return queryTranslator.translate(ast);
    }),
  );
  ipcMain.handle(
    IpcChannel.SEARCH_REVERT,
    withErrorHandling(async (event, searchId) => {
      return db.revertSearch(searchId);
    }),
  );
  // Articles
  ipcMain.handle(
    IpcChannel.ARTICLES_GET_BY_PROJECT,
    withErrorHandling(async (event, projectId) => {
      return db.getArticlesByProject(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.ARTICLES_GET_ONE,
    withErrorHandling(async (event, id) => {
      return db.getArticle(id);
    }),
  );
  ipcMain.handle(
    IpcChannel.ARTICLES_UPDATE_STATUS,
    withErrorHandling(async (event, id, status, note) => {
      return db.updateArticleStatus(id, status, note);
    }),
  );
  ipcMain.handle(
    IpcChannel.ARTICLES_UPDATE_METADATA,
    withErrorHandling(async (event, id, data) => {
      return db.updateArticleMetadata(id, data);
    }),
  );
  // Settings
  ipcMain.handle(
    IpcChannel.SETTINGS_GET,
    withErrorHandling(async (event, key) => {
      return db.getSetting(key);
    }),
  );
  ipcMain.handle(
    IpcChannel.SETTINGS_SET,
    withErrorHandling(async (event, key, value) => {
      return db.setSetting(key, value);
    }),
  );
  // Annotations
  ipcMain.handle(
    IpcChannel.ANNOTATIONS_GET,
    withErrorHandling(async (event, articleId) => {
      return db.getAnnotations(articleId);
    }),
  );
  ipcMain.handle(
    IpcChannel.ANNOTATIONS_CREATE,
    withErrorHandling(async (event, articleId, content) => {
      return db.saveAnnotation(articleId, content);
    }),
  );
  ipcMain.handle(
    IpcChannel.ANNOTATIONS_UPDATE,
    withErrorHandling(async (event, id, content) => {
      return db.updateAnnotation(id, content);
    }),
  );
  ipcMain.handle(
    IpcChannel.ANNOTATIONS_DELETE,
    withErrorHandling(async (event, id) => {
      return db.deleteAnnotation(id);
    }),
  );
  // Highlights
  ipcMain.handle(
    IpcChannel.HIGHLIGHTS_GET,
    withErrorHandling(async (event, articleId) => {
      return db.getHighlights(articleId);
    }),
  );
  ipcMain.handle(
    IpcChannel.HIGHLIGHTS_CREATE,
    withErrorHandling(async (event, articleId, color, positionData, contentText, content) => {
      let annId;
      if (content) {
        annId = db.saveAnnotation(articleId, content);
      }
      return db.saveHighlight(articleId, color, positionData, contentText, annId);
    }),
  );
  ipcMain.handle(
    IpcChannel.HIGHLIGHTS_DELETE,
    withErrorHandling(async (event, id) => {
      return db.deleteHighlight(id);
    }),
  );
  // Helper to hash files
  function getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  // Helper to generate stored PDF filename: Date stamp + original filename
  function generateStoredFilename(sourceFilePath: string): string {
    const originalName = path.basename(sourceFilePath).replace(/[^a-zA-Z0-9._-]/g, '_');
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `${dateStamp}_${timeStamp}_${originalName}`;
  }

  // Helper to store PDF file in library storage
  function savePdfToStorage(sourceFilePath: string): { destPath: string; hash: string; filename: string; size: number } {
    const hash = getFileHash(sourceFilePath);
    const pdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const existing = db.getPdfByHash(hash);
    let destPath: string;
    let storedName: string;

    if (existing && existing.file_path && fs.existsSync(existing.file_path)) {
      destPath = existing.file_path;
      storedName = existing.filename || path.basename(destPath);
    } else {
      storedName = generateStoredFilename(sourceFilePath);
      destPath = path.join(pdfsDir, storedName);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(sourceFilePath, destPath);
      }
    }
    const size = fs.statSync(destPath).size;
    db.registerPdfInLibrary(destPath, hash, storedName, size);
    return { destPath, hash, filename: storedName, size };
  }

  // PDF
  ipcMain.handle(
    IpcChannel.PDF_UPLOAD,
    withErrorHandling(async (event, articleId, sourceFilePath) => {
      const { destPath } = savePdfToStorage(sourceFilePath);
      db.linkPdfToArticle(articleId, destPath);
      return destPath;
    }),
  );
  ipcMain.handle(
    IpcChannel.PDF_GET,
    withErrorHandling(async (event, articleId) => {
      const article = db.getArticle(articleId);
      if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
        throw new Error(
          `[ERR_NOT_FOUND] PDF não encontrado. Offending value: articleId=${articleId}. Expected shape: ID de artigo com arquivo PDF existente em disco.`
        );
      }
      const buffer = fs.readFileSync(article.local_file_path);
      return buffer;
    }),
  );
  ipcMain.handle(
    IpcChannel.PDF_UNLINK,
    withErrorHandling(async (event, articleId) => {
      const article = db.getArticle(articleId);
      if (!article || !article.local_file_path) return;
      const filePath = article.local_file_path;
      db.unlinkPdfFromArticle(articleId);
      const refCount = db.getArticlesForPdf(filePath).length;
      if (refCount === 0 && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          db.deletePdfRecord(filePath);
        } catch (err) {
          console.error('Failed to delete physical PDF file:', err);
        }
      }
    }),
  );

  // Global PDF Library channels
  ipcMain.handle(
    IpcChannel.PDF_LIBRARY_LIST,
    withErrorHandling(async () => {
      return db.getStoredPdfs();
    }),
  );
  ipcMain.handle(
    IpcChannel.PDF_LIBRARY_DELETE,
    withErrorHandling(async (event, filePath) => {
      const articleIds = db.deletePdfLibraryRecord(filePath);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Failed to delete physical PDF file:', err);
        }
      }
      return articleIds;
    }),
  );
  ipcMain.handle(
    IpcChannel.PDF_LIBRARY_LINK,
    withErrorHandling(async (event, articleId, filePath) => {
      db.linkPdfToArticle(articleId, filePath);
    }),
  );
  ipcMain.handle(
    IpcChannel.PDF_LIBRARY_UPLOAD,
    withErrorHandling(async (event, sourceFilePath) => {
      const { destPath } = savePdfToStorage(sourceFilePath);
      return destPath;
    }),
  );

  // Cross-project Article Sharing
  ipcMain.handle(
    IpcChannel.ARTICLES_IMPORT_FROM_PROJECT,
    withErrorHandling(async (event, sourceProjectId, destProjectId, articleIds) => {
      const sourceProj = db.getProject(sourceProjectId);
      const sourceName = sourceProj ? sourceProj.name : `Projeto ID ${sourceProjectId}`;
      const unifiedQuery = `Importação de artigos do projeto '${sourceName}'`;
      const translated = { import: `Origem: Projeto ID ${sourceProjectId}` };
      const breakdown = { import: { count: articleIds.length } };
      const searchId = db.saveSearchHistory(destProjectId, unifiedQuery, translated, articleIds.length, breakdown);
      db.importArticlesFromProject(sourceProjectId, destProjectId, articleIds, searchId);
      return searchId;
    }),
  );
  ipcMain.handle(
    IpcChannel.ARTICLES_CREATE_MANUAL,
    withErrorHandling(async (event, projectId, data, sourceFilePath) => {
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
    }),
  );
  ipcMain.handle(
    IpcChannel.ARTICLES_CREATE_FROM_PDFS,
    withErrorHandling(async (event, projectId, filePaths) => {
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
          // Copy the PDF and register in Global PDF Library
          const { destPath } = savePdfToStorage(sourceFilePath);
          db.linkPdfToArticle(articleId, destPath);
          addedCount++;
        } catch (err) {
          console.error('Failed to copy PDF file for batch import:', err);
        }
      }
      return addedCount;
    }),
  );
  // CSV Export
  ipcMain.handle(
    IpcChannel.EXPORT_CSV,
    withErrorHandling(async (event, projectId) => {
      const project = db.getProject(projectId);
      const articles = db.getArticlesByProject(projectId);
      const projectCategories = db.getProjectCategories(projectId);
      const articleCategories = db.getAllProjectArticleCategories(projectId);
      if (!project) {
        throw new Error(
          `[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=${projectId}. Expected shape: ID numérico de projeto cadastrado.`
        );
      }
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
    }),
  );
  // XLSX Export
  ipcMain.handle(
    IpcChannel.EXPORT_XLSX,
    withErrorHandling(async (event, projectId) => {
      const project = db.getProject(projectId);
      const articles = db.getArticlesByProject(projectId);
      const projectCategories = db.getProjectCategories(projectId);
      const articleCategories = db.getAllProjectArticleCategories(projectId);
      if (!project) {
        throw new Error(
          `[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=${projectId}. Expected shape: ID numérico de projeto cadastrado.`
        );
      }
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
    }),
  );
  // Dialog for file open
  ipcMain.handle(
    IpcChannel.DIALOG_OPEN_FILE,
    withErrorHandling(async (event) => {
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
    }),
  );
  ipcMain.handle(
    IpcChannel.DIALOG_OPEN_MULTIPLE_FILES,
    withErrorHandling(async (event) => {
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
    }),
  );

  ipcMain.handle(
    IpcChannel.DIALOG_SAVE_FILE,
    withErrorHandling(async (event, content, defaultPath) => {
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
    }),
  );
  // Diary
  ipcMain.handle(
    IpcChannel.DIARY_GET_ALL,
    withErrorHandling(async (event, projectId) => {
      return db.getDiaryEntries(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.DIARY_GET_ONE,
    withErrorHandling(async (event, projectId, entryDate) => {
      return db.getDiaryEntry(projectId, entryDate);
    }),
  );
  ipcMain.handle(
    IpcChannel.DIARY_SAVE,
    withErrorHandling(async (event, projectId, entryDate, content) => {
      return db.saveDiaryEntry(projectId, entryDate, content);
    }),
  );
  ipcMain.handle(
    IpcChannel.DIARY_DELETE,
    withErrorHandling(async (event, projectId, entryDate) => {
      return db.deleteDiaryEntry(projectId, entryDate);
    }),
  );
  // Biblioshiny Export (Scopus CSV format — exact 45-column layout from real Scopus export)
  ipcMain.handle(
    IpcChannel.EXPORT_BIBLIOSHINY,
    withErrorHandling(async (event, projectId) => {
      const project = db.getProject(projectId);
      const articles = db.getArticlesByProject(projectId);
      if (!project) {
        throw new Error(
          `[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=${projectId}. Expected shape: ID numérico de projeto cadastrado.`
        );
      }
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
    }),
  );
  // App Info
  ipcMain.handle(
    IpcChannel.APP_GET_VERSION,
    withErrorHandling(async () => {
      return app.getVersion();
    }),
  );

  // Pending Highlights
  ipcMain.handle(
    IpcChannel.PENDING_HIGHLIGHTS_GET,
    withErrorHandling(async (event, articleId) => {
      return db.getPendingHighlights(articleId);
    }),
  );
  ipcMain.handle(
    IpcChannel.PENDING_HIGHLIGHTS_DELETE,
    withErrorHandling(async (event, id) => {
      return db.deletePendingHighlight(id);
    }),
  );
  // Project Documents
  ipcMain.handle(
    IpcChannel.PROJECT_DOCUMENTS_GET,
    withErrorHandling(async (event, projectId) => {
      return db.getProjectDocuments(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECT_DOCUMENTS_CREATE,
    withErrorHandling(async (event, projectId, title, url, sourceFilePath, category) => {
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
      return db.saveProjectDocument(projectId, title, url ?? null, destPath ?? null, category ?? null);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECT_DOCUMENTS_UPDATE,
    withErrorHandling(async (event, id, title, url, sourceFilePath, category) => {
      let destPath = sourceFilePath ?? null;
      if (sourceFilePath && typeof sourceFilePath === 'string' && !sourceFilePath.includes(path.join('storage', 'project_documents'))) {
        try {
          const docsDir = path.join(app.getPath('userData'), 'storage', 'project_documents');
          if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
          }
          destPath = path.join(docsDir, `doc_${Date.now()}.pdf`);
          fs.copyFileSync(sourceFilePath, destPath);
        } catch (err) {
          console.error('Failed to copy PDF file for updating project document:', err);
        }
      }
      return db.updateProjectDocument(id, title, url ?? null, destPath ?? null, category ?? null);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECT_DOCUMENTS_REORDER,
    withErrorHandling(async (event, projectId, orderedIds) => {
      return db.reorderProjectDocuments(projectId, orderedIds || []);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECT_DOCUMENTS_DELETE,
    withErrorHandling(async (event, id) => {
      return db.deleteProjectDocument(id);
    }),
  );
  ipcMain.handle(
    IpcChannel.PROJECT_DOCUMENT_OPEN_EXTERNAL,
    withErrorHandling(async (event, url, filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        await shell.openPath(filePath);
      } else if (url) {
        await shell.openExternal(url);
      }
    }),
  );
  // Massive Investigations
  ipcMain.handle(
    IpcChannel.MASSIVE_INVESTIGATIONS_GET,
    withErrorHandling(async (event, projectId) => {
      return db.getMassiveInvestigations(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.MASSIVE_INVESTIGATIONS_SAVE,
    withErrorHandling(async (event, projectId, questions, articlesIds, modelUsed, status) => {
      return db.saveMassiveInvestigation(projectId, questions, articlesIds, modelUsed, status);
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_GET_PROJECT,
    withErrorHandling(async (event, projectId) => {
      return db.getProjectCategories(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_CREATE_PROJECT,
    withErrorHandling(async (event, projectId, name, type, options) => {
      return db.createProjectCategory(projectId, name, type, options);
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_UPDATE_PROJECT,
    withErrorHandling(async (event, categoryId, name, type, options) => {
      db.updateProjectCategory(categoryId, name, type, options);
      return true;
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_DELETE_PROJECT,
    withErrorHandling(async (event, categoryId) => {
      db.deleteProjectCategory(categoryId);
      return true;
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_GET_ARTICLE,
    withErrorHandling(async (event, articleId) => {
      return db.getArticleCategories(articleId);
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_SET_ARTICLE,
    withErrorHandling(async (event, articleId, categoryId, value) => {
      db.setArticleCategory(articleId, categoryId, value);
      return true;
    }),
  );
  ipcMain.handle(
    IpcChannel.CATEGORIES_GET_ALL_PROJECT_ARTICLE,
    withErrorHandling(async (event, projectId) => {
      return db.getAllProjectArticleCategories(projectId);
    }),
  );
  // Sync
  ipcMain.handle(
    IpcChannel.SYNC_EXPORT_PROJECT,
    withErrorHandling(async (event, projectId) => {
      return await syncService.exportProject(projectId);
    }),
  );
  ipcMain.handle(
    IpcChannel.SYNC_IMPORT_PROJECT,
    withErrorHandling(async (event, filePath) => {
      return await syncService.importProject(filePath);
    }),
  );
  // Trash Bin
  ipcMain.handle(
    IpcChannel.TRASH_GET_ITEMS,
    withErrorHandling(async () => {
      return db.getTrashItems();
    }),
  );
  ipcMain.handle(
    IpcChannel.TRASH_RESTORE_ITEM,
    withErrorHandling(async (event, type, id) => {
      return db.restoreTrashItem(type, id);
    }),
  );
  ipcMain.handle(
    IpcChannel.TRASH_PERMANENT_DELETE,
    withErrorHandling(async (event, type, id) => {
      return db.deleteTrashItemPermanent(type, id);
    }),
  );
  ipcMain.handle(
    IpcChannel.TRASH_EMPTY,
    withErrorHandling(async () => {
      return db.emptyTrash();
    }),
  );
  // Diary History
  ipcMain.handle(
    IpcChannel.DIARY_GET_HISTORY,
    withErrorHandling(async (event, projectId, entryDate) => {
      return db.getDiaryEntryHistory(projectId, entryDate);
    }),
  );
  ipcMain.handle(
    IpcChannel.DIARY_RESTORE_VERSION,
    withErrorHandling(async (event, versionId) => {
      return db.restoreDiaryEntryVersion(versionId);
    }),
  );
  // Manual Backup & Restore
  ipcMain.handle(
    IpcChannel.BACKUP_EXPORT,
    withErrorHandling(async () => {
      return syncService.exportBackup();
    }),
  );
  ipcMain.handle(
    IpcChannel.BACKUP_RESTORE_OVERRIDE,
    withErrorHandling(async () => {
      return syncService.restoreBackupOverride();
    }),
  );
  ipcMain.handle(
    IpcChannel.BACKUP_RESTORE_MERGE,
    withErrorHandling(async () => {
      return syncService.restoreBackupMerge();
    }),
  );
  ipcMain.handle(
    IpcChannel.BACKUP_LIST_AUTO,
    withErrorHandling(async () => {
      return backupService.listAutoBackups();
    }),
  );
  ipcMain.handle(
    IpcChannel.BACKUP_RESTORE_AUTO,
    withErrorHandling(async (event, filename: string) => {
      return backupService.restoreAutoBackup(filename);
    }),
  );
  const venueRepo = new ScientificVenueRepository(db.getDB());

  ipcMain.handle(
    IpcChannel.SCIENTIFIC_VENUES_GET_ALL,
    withErrorHandling(async () => {
      return venueRepo.getAllVenues();
    }),
  );
  ipcMain.handle(
    IpcChannel.SCIENTIFIC_VENUE_CREATE,
    withErrorHandling(async (event, venueData) => {
      return venueRepo.createVenue(venueData);
    }),
  );
  ipcMain.handle(
    IpcChannel.SCIENTIFIC_VENUE_UPDATE,
    withErrorHandling(async (event, { id, venueData }) => {
      return venueRepo.updateVenue(id, venueData);
    }),
  );
  ipcMain.handle(
    IpcChannel.SCIENTIFIC_VENUE_DELETE,
    withErrorHandling(async (event, id) => {
      return venueRepo.deleteVenue(id);
    }),
  );
  ipcMain.handle(
    IpcChannel.SCIENTIFIC_MILESTONE_TOGGLE_STATUS,
    withErrorHandling(async (event, { milestoneId, status }) => {
      return venueRepo.toggleMilestoneStatus(milestoneId, status);
    }),
  );
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
