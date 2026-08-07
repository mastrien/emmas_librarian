const fs = require('fs');

const adapterContent = fs.readFileSync('electron/database/DatabaseAdapter.ts', 'utf8');

const lines = adapterContent.split('\n');
const initSchemaEndIndex = lines.findIndex(line => line.includes('// Projects')) - 1;

let newAdapter = lines.slice(0, initSchemaEndIndex).join('\n');

const importsToAdd = `
import { ProjectRepository } from './ProjectRepository';
import { SettingsRepository } from './SettingsRepository';
import { ArticleRepository } from './ArticleRepository';
import { HistoryRepository } from './HistoryRepository';
import { DocumentRepository } from './DocumentRepository';
import { AnnotationRepository } from './AnnotationRepository';
import { TrashRepository } from './TrashRepository';
import { MassiveInvestigationRepository } from './MassiveInvestigationRepository';
`;

newAdapter = newAdapter.replace('import crypto from \'crypto\';', `import crypto from 'crypto';${importsToAdd}`);

const constructorAndProps = `
  public projectRepo: ProjectRepository;
  public settingsRepo: SettingsRepository;
  public articleRepo: ArticleRepository;
  public historyRepo: HistoryRepository;
  public documentRepo: DocumentRepository;
  public annotationRepo: AnnotationRepository;
  public trashRepo: TrashRepository;
  public investigationRepo: MassiveInvestigationRepository;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.loadSqliteVec(this.db);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.projectRepo = new ProjectRepository(this.db);
    this.settingsRepo = new SettingsRepository(this.db);
    this.articleRepo = new ArticleRepository(this.db);
    this.historyRepo = new HistoryRepository(this.db);
    this.documentRepo = new DocumentRepository(this.db);
    this.annotationRepo = new AnnotationRepository(this.db);
    this.trashRepo = new TrashRepository(this.db, this.projectRepo);
    this.investigationRepo = new MassiveInvestigationRepository(this.db);

    this.initSchema();
  }
`;

newAdapter = newAdapter.replace(/constructor\(dbPath: string\) \{[\s\S]*?initSchema\(\);\s*\}/, constructorAndProps.trim());

const backfillExistingPdfsCall = `
      // Run PDF backfill
      this.articleRepo.backfillExistingPdfs();
`;
newAdapter = newAdapter.replace(/this\.backfillExistingPdfs\(\);/, backfillExistingPdfsCall.trim());

// Add all the delegated methods
newAdapter += `

  // --- Project ---
  createProject(name: string): Project { return this.projectRepo.createProject(name); }
  getProject(id: number): Project | undefined { return this.projectRepo.getProject(id); }
  updateProjectWritingPad(id: number, content: string) { return this.projectRepo.updateProjectWritingPad(id, content); }
  getProjectWritingPad(id: number): string | null { return this.projectRepo.getProjectWritingPad(id); }
  updateProject(id: number, name: string): void { return this.projectRepo.updateProject(id, name); }
  deleteProject(id: number): void { return this.projectRepo.deleteProject(id); }
  deleteProjectPermanent(id: number): void { return this.projectRepo.deleteProjectPermanent(id); }
  getAllProjects(): Project[] { return this.projectRepo.getAllProjects(); }

  // --- Article ---
  findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined { return this.articleRepo.findDuplicateArticle(projectId, doi, title); }
  saveArticle(projectId: number, data: ArticleInput): number { return this.articleRepo.saveArticle(projectId, data); }
  getArticle(id: number): Article | undefined { return this.articleRepo.getArticle(id); }
  getArticlesByProject(projectId: number): Article[] { return this.articleRepo.getArticlesByProject(projectId); }
  updateArticleFilePath(articleId: number, path: string | null): void { return this.articleRepo.updateArticleFilePath(articleId, path); }
  updateArticleStatus(articleId: number, status: 'new' | 'read' | 'archived', archiveNote?: string): void { return this.articleRepo.updateArticleStatus(articleId, status, archiveNote); }
  updateArticleMetadata(articleId: number, data: Partial<ArticleInput>): void { return this.articleRepo.updateArticleMetadata(articleId, data); }
  updateArticleAiSummary(articleId: number, summary: string): void { return this.articleRepo.updateArticleAiSummary(articleId, summary); }
  deleteArticle(id: number): void { return this.articleRepo.deleteArticle(id); }

  // --- Annotation & Highlight ---
  saveAnnotation(articleId: number, content: string): number { return this.annotationRepo.saveAnnotation(articleId, content); }
  getAnnotations(articleId: number): Annotation[] { return this.annotationRepo.getAnnotations(articleId); }
  updateAnnotation(id: number, content: string): void { return this.annotationRepo.updateAnnotation(id, content); }
  deleteAnnotation(id: number): void { return this.annotationRepo.deleteAnnotation(id); }
  saveHighlight(articleId: number, color: string, positionData: string, contentText: string | null, annotationId?: number): number { return this.annotationRepo.saveHighlight(articleId, color, positionData, contentText, annotationId); }
  getHighlights(articleId: number): HighlightWithComment[] { return this.annotationRepo.getHighlights(articleId); }
  deleteHighlight(id: number): void { return this.annotationRepo.deleteHighlight(id); }
  savePendingHighlight(articleId: number, quote: string, contextBefore: string, contextAfter: string, comment: string): number { return this.annotationRepo.savePendingHighlight(articleId, quote, contextBefore, contextAfter, comment); }
  getPendingHighlights(articleId: number): Highlight[] { return this.annotationRepo.getPendingHighlights(articleId); }
  deletePendingHighlight(id: number): void { return this.annotationRepo.deletePendingHighlight(id); }

  // --- Massive Investigation ---
  saveMassiveInvestigation(projectId: number, questions: string[], articlesIds: number[], modelUsed: string, status: string): number { return this.investigationRepo.saveMassiveInvestigation(projectId, questions, articlesIds, modelUsed, status); }
  getMassiveInvestigations(projectId: number): unknown[] { return this.investigationRepo.getMassiveInvestigations(projectId); }

  // --- Settings ---
  public getSetting(key: string): string | null { return this.settingsRepo.getSetting(key); }
  public setSetting(key: string, value: string): void { return this.settingsRepo.setSetting(key, value); }

  // --- History ---
  public saveSearchHistory(projectId: number, unifiedQuery: string, translatedQueries: Record<string, string>, totalResults: number, breakdown: Record<string, unknown>, sortBy?: string, limitVal?: number): number { return this.historyRepo.saveSearchHistory(projectId, unifiedQuery, translatedQueries, totalResults, breakdown, sortBy, limitVal); }
  public getSearchHistory(projectId: number): unknown[] { return this.historyRepo.getSearchHistory(projectId); }
  public revertSearch(searchId: number): void { return this.historyRepo.revertSearch(searchId); }
  public saveDiaryEntry(projectId: number, entryDate: string, content: string): void { return this.historyRepo.saveDiaryEntry(projectId, entryDate, content); }
  public getDiaryEntries(projectId: number): DiaryEntry[] { return this.historyRepo.getDiaryEntries(projectId); }
  public getDiaryEntry(projectId: number, entryDate: string): DiaryEntry | undefined { return this.historyRepo.getDiaryEntry(projectId, entryDate); }
  public deleteDiaryEntry(projectId: number, entryDate: string): void { return this.historyRepo.deleteDiaryEntry(projectId, entryDate); }
  public getDiaryEntryHistory(projectId: number, entryDate: string): unknown[] { return this.historyRepo.getDiaryEntryHistory(projectId, entryDate); }
  public restoreDiaryEntryVersion(versionId: number): void { return this.historyRepo.restoreDiaryEntryVersion(versionId); }

  // --- Documents ---
  public saveProjectDocument(projectId: number, title: string, url?: string | null, localFilePath?: string | null, category?: string | null): number { return this.documentRepo.saveProjectDocument(projectId, title, url, localFilePath, category); }
  public getProjectDocuments(projectId: number): ProjectDocument[] { return this.documentRepo.getProjectDocuments(projectId); }
  public updateProjectDocument(id: number, title: string, url: string | null, localFilePath: string | null, category: string | null): void { return this.documentRepo.updateProjectDocument(id, title, url, localFilePath, category); }
  public reorderProjectDocuments(projectId: number, orderedIds: number[]): void { return this.documentRepo.reorderProjectDocuments(projectId, orderedIds); }
  public deleteProjectDocument(id: number): void { return this.documentRepo.deleteProjectDocument(id); }

  // --- Categories ---
  public getProjectCategories(projectId: number): ProjectCategory[] { return this.projectRepo.getProjectCategories(projectId); }
  public createProjectCategory(projectId: number, name: string, type: string, options?: string | null): number { return this.projectRepo.createProjectCategory(projectId, name, type as any); }
  public updateProjectCategory(categoryId: number, name: string, type: string, options?: string | null): void { return this.projectRepo.updateProjectCategory(categoryId, name, type as any, options); }
  public syncProjectCategoryOptions(categoryId: number, options: { id?: number; name: string }[]): void { return this.projectRepo.syncProjectCategoryOptions(categoryId, options); }
  public deleteProjectCategory(categoryId: number): void { return this.projectRepo.deleteProjectCategory(categoryId); }
  public getArticleCategories(articleId: number): ArticleCategory[] { return this.articleRepo.getArticleCategories(articleId); }
  public getAllProjectArticleCategories(projectId: number): ArticleCategory[] { return this.articleRepo.getAllProjectArticleCategories(projectId); }
  public setArticleCategory(articleId: number, categoryId: number, value: string | null): void { return this.articleRepo.setArticleCategory(articleId, categoryId, value); }

  // --- Trash ---
  public getTrashItems(): unknown[] { return this.trashRepo.getTrashItems(); }
  public restoreTrashItem(type: 'project' | 'article' | 'annotation', id: number): void { return this.trashRepo.restoreTrashItem(type, id); }
  public deleteTrashItemPermanent(type: 'project' | 'article' | 'annotation', id: number): void { return this.trashRepo.deleteTrashItemPermanent(type, id); }
  public emptyTrash(): void { return this.trashRepo.emptyTrash(); }

  // --- PDF Library & Sync ---
  public getStoredPdfs(): unknown[] { return this.articleRepo.getStoredPdfs(); }
  public getArticlesForPdf(filePath: string): { id: number; title: string; project_id: number }[] { return this.articleRepo.getArticlesForPdf(filePath); }
  public deletePdfRecord(filePath: string): void { return this.articleRepo.deletePdfRecord(filePath); }
  public deletePdfLibraryRecord(filePath: string): number[] { return this.articleRepo.deletePdfLibraryRecord(filePath); }
  public unlinkPdfFromArticle(articleId: number): void { return this.articleRepo.unlinkPdfFromArticle(articleId); }
  public linkPdfToArticle(articleId: number, filePath: string): void { return this.articleRepo.linkPdfToArticle(articleId, filePath); }
  public registerPdfInLibrary(filePath: string, hash: string, filename: string, size: number): void { return this.articleRepo.registerPdfInLibrary(filePath, hash, filename, size); }
  public importArticlesFromProject(sourceProjectId: number, destProjectId: number, articleIds: number[], searchHistoryId: number): void { return this.articleRepo.importArticlesFromProject(sourceProjectId, destProjectId, articleIds, searchHistoryId); }
  public getPdfByHash(hash: string): any { return this.articleRepo.getPdfByHash(hash); }

  // --- Maintenance ---
  public checkIntegrity(): boolean {
    try {
      const result = this.db.pragma('integrity_check') as Record<string, unknown>[];
      if (!result || result.length === 0) return false;
      const firstRow = result[0];
      const val = firstRow.integrity_check || firstRow['integrity_check'];
      return val === 'ok';
    } catch (e) {
      console.error('Failed to check database integrity:', e);
      return false;
    }
  }

  public checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  public close(): void {
    this.db.close();
  }
}
`;

fs.writeFileSync('electron/database/DatabaseAdapter.ts', newAdapter);
console.log('DatabaseAdapter successfully refactored.');
