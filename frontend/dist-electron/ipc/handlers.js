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
const types_1 = require("../types");
function setupIpcHandlers() {
    const dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'emma.db');
    const db = new DatabaseManager_1.DatabaseManager(dbPath);
    const translator = new QueryTranslator_1.QueryTranslator();
    const api = new ApiIntegrator_1.ApiIntegrator();
    const orchestrator = new SearchOrchestrator_1.SearchOrchestrator(db, translator, api);
    // Projects
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_GET_ALL, () => {
        return db.getAllProjects();
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_CREATE, (event, name) => {
        return db.createProject(name);
    });
    electron_1.ipcMain.handle(types_1.IpcChannel.PROJECTS_GET_ONE, (event, id) => {
        return db.getProject(id);
    });
    // Search
    electron_1.ipcMain.handle(types_1.IpcChannel.SEARCH_EXECUTE, async (event, projectId, queryBlocks, limit) => {
        return await orchestrator.executeSearch(projectId, queryBlocks, limit);
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
    // CSV Export
    electron_1.ipcMain.handle(types_1.IpcChannel.EXPORT_CSV, async (event, projectId) => {
        const project = db.getProject(projectId);
        const articles = db.getArticlesByProject(projectId);
        if (!project)
            throw new Error("Project not found");
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
}
