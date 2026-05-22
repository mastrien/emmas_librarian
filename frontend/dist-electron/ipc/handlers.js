"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIpcHandlers = setupIpcHandlers;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DatabaseManager_1 = require("../database/DatabaseManager");
const SearchOrchestrator_1 = require("../services/SearchOrchestrator");
const QueryTranslator_1 = require("../services/QueryTranslator");
const ApiIntegrator_1 = require("../services/ApiIntegrator");
const ExportService_1 = require("../services/ExportService");
const types_1 = require("../types");
function setupIpcHandlers() {
    const dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'emma.db');
    const db = new DatabaseManager_1.DatabaseManager(dbPath);
    const translator = new QueryTranslator_1.QueryTranslator();
    const api = new ApiIntegrator_1.ApiIntegrator();
    const orchestrator = new SearchOrchestrator_1.SearchOrchestrator(db, translator, api);
    const exportService = new ExportService_1.ExportService();
    // Projects
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_GET_ALL, () => {
        return db.getAllProjects();
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_CREATE, (event, name) => {
        return db.createProject(name);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_GET_ONE, async (event, projectId) => {
        return db.getProject(projectId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_GET_SEARCH_HISTORY, async (event, projectId) => {
        return db.getSearchHistory(projectId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_UPDATE, async (event, id, name) => {
        return db.updateProject(id, name);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_DELETE, async (event, id) => {
        return db.deleteProject(id);
    });
    // Search
    electron_1.ipcMain.handle(types_1.IpcChannel.SEARCH_EXECUTE, async (event, projectId, queryMap, limit, sortBy, unifiedQuery) => {
        return orchestrator.searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.SEARCH_TRANSLATE_QUERY, (event, ast) => {
        return QueryTranslator_1.queryTranslator.translate(ast);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.SEARCH_REVERT, async (event, searchId) => {
        return db.revertSearch(searchId);
    });
    // Articles
    electron_1.ipcMain.handle(types_1.IpcChannel.ARTICLES_GET_BY_PROJECT, (event, projectId) => {
        return db.getArticlesByProject(projectId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.ARTICLES_GET_ONE, (event, id) => {
        return db.getArticle(id);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.ARTICLES_UPDATE_STATUS, (event, id, status, note) => {
        return db.updateArticleStatus(id, status, note);
    });
    // Settings
    electron_1.ipcMain.handle(types_1.IpcChannel.SETTINGS_GET, (event, key) => {
        return db.getSetting(key);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.SETTINGS_SET, (event, key, value) => {
        return db.setSetting(key, value);
    });
    // Annotations
    electron_1.ipcMain.handle(types_1.IpcChannel.ANNOTATIONS_GET, (event, articleId) => {
        return db.getAnnotations(articleId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.ANNOTATIONS_CREATE, (event, articleId, content) => {
        return db.saveAnnotation(articleId, content);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.ANNOTATIONS_UPDATE, (event, id, content) => {
        return db.updateAnnotation(id, content);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.ANNOTATIONS_DELETE, (event, id) => {
        return db.deleteAnnotation(id);
    });
    // Highlights
    electron_1.ipcMain.handle(types_1.IpcChannel.HIGHLIGHTS_GET, (event, articleId) => {
        return db.getHighlights(articleId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.HIGHLIGHTS_CREATE, (event, articleId, color, positionData, content) => {
        let annId;
        if (content) {
            annId = db.saveAnnotation(articleId, content);
        }
        return db.saveHighlight(articleId, color, positionData, annId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.HIGHLIGHTS_DELETE, (event, id) => {
        return db.deleteHighlight(id);
    });
    // PDF
    electron_1.ipcMain.handle(types_1.IpcChannel.PDF_UPLOAD, async (event, articleId, sourceFilePath) => {
        const pdfsDir = path_1.default.join(electron_1.app.getPath('userData'), 'storage', 'pdfs');
        if (!fs_1.default.existsSync(pdfsDir)) {
            fs_1.default.mkdirSync(pdfsDir, { recursive: true });
        }
        const destPath = path_1.default.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
        fs_1.default.copyFileSync(sourceFilePath, destPath);
        db.updateArticleFilePath(articleId, destPath);
        return destPath;
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PDF_GET, async (event, articleId) => {
        const article = db.getArticle(articleId);
        if (!article || !article.local_file_path || !fs_1.default.existsSync(article.local_file_path)) {
            throw new Error("PDF not found");
        }
        const buffer = fs_1.default.readFileSync(article.local_file_path);
        return buffer;
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PDF_UNLINK, async (event, articleId) => {
        const article = db.getArticle(articleId);
        if (article && article.local_file_path) {
            try {
                if (fs_1.default.existsSync(article.local_file_path)) {
                    fs_1.default.unlinkSync(article.local_file_path);
                }
            }
            catch (err) {
                console.error("Failed to delete physical PDF file:", err);
            }
            db.updateArticleFilePath(articleId, null);
        }
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.ARTICLES_CREATE_MANUAL, async (event, projectId, data, sourceFilePath) => {
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
                const pdfsDir = path_1.default.join(electron_1.app.getPath('userData'), 'storage', 'pdfs');
                if (!fs_1.default.existsSync(pdfsDir)) {
                    fs_1.default.mkdirSync(pdfsDir, { recursive: true });
                }
                const destPath = path_1.default.join(pdfsDir, `${articleId}_${Date.now()}.pdf`);
                fs_1.default.copyFileSync(sourceFilePath, destPath);
                db.updateArticleFilePath(articleId, destPath);
            }
            catch (err) {
                console.error("Failed to copy PDF file for manual article:", err);
            }
        }
        try {
            db.saveSearchHistory(projectId, `Adição manual de artigo avulso: ${data.title}`, {}, 1, { "Manual": { "count": 1 } });
        }
        catch (err) {
            console.error("Failed to log manual article creation to search history:", err);
        }
        return articleId;
    });
    // CSV Export
    electron_1.ipcMain.handle(types_1.IpcChannel.EXPORT_CSV, async (event, projectId) => {
        const project = db.getProject(projectId);
        const articles = db.getArticlesByProject(projectId);
        if (!project)
            throw new Error("Project not found");
        const csvContent = exportService.exportToCsv(articles);
        const { canceled, filePath } = await electron_1.dialog.showSaveDialog({
            title: 'Export Articles CSV',
            defaultPath: `project_${projectId}_export.csv`,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });
        if (!canceled && filePath) {
            fs_1.default.writeFileSync(filePath, csvContent);
            return filePath;
        }
        return null;
    });
    // Dialog for file open
    electron_1.ipcMain.handle(types_1.IpcChannel.DIALOG_OPEN_FILE, async (event) => {
        const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });
        if (!canceled && filePaths.length > 0) {
            return filePaths[0];
        }
        return null;
    });
    // Diary
    electron_1.ipcMain.handle(types_1.IpcChannel.DIARY_GET_ALL, (event, projectId) => {
        return db.getDiaryEntries(projectId);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.DIARY_GET_ONE, (event, projectId, entryDate) => {
        return db.getDiaryEntry(projectId, entryDate);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.DIARY_SAVE, (event, projectId, entryDate, content) => {
        return db.saveDiaryEntry(projectId, entryDate, content);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.DIARY_DELETE, (event, projectId, entryDate) => {
        return db.deleteDiaryEntry(projectId, entryDate);
    });
    // Biblioshiny Export (Scopus CSV format — exact 45-column layout from real Scopus export)
    electron_1.ipcMain.handle(types_1.IpcChannel.EXPORT_BIBLIOSHINY, async (event, projectId) => {
        const project = db.getProject(projectId);
        const articles = db.getArticlesByProject(projectId);
        if (!project)
            throw new Error("Project not found");
        const csvContent = exportService.exportToBiblioshiny(articles);
        const { canceled, filePath } = await electron_1.dialog.showSaveDialog({
            title: 'Exportar para Biblioshiny',
            defaultPath: `${project.name}_biblioshiny.csv`,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });
        if (!canceled && filePath) {
            fs_1.default.writeFileSync(filePath, csvContent, 'utf-8');
            return filePath;
        }
        return null;
    });
    // App Info
    electron_1.ipcMain.handle(types_1.IpcChannel.APP_GET_VERSION, () => {
        return electron_1.app.getVersion();
    });
}
