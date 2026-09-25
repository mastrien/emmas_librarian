import fs from 'fs';
import { dialog } from 'electron';
import { IpcChannel, type Project } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { ExportService } from '../../services/ExportService';
import { handle, type IpcRegistrar } from './handle';

interface SaveTarget {
  title: string;
  defaultPath: string;
  filterName: string;
  extension: string;
}

/**
 * Project exports to CSV, XLSX and the Scopus-style CSV that Biblioshiny reads.
 *
 * Usage:
 *   registerExportHandlers(ipcMain, db, new ExportService());
 */
export function registerExportHandlers(ipc: IpcRegistrar, db: DatabaseAdapter, exportService: ExportService): void {
  handle(ipc, IpcChannel.EXPORT_CSV, (_e, projectId: number) => {
    requireProject(db, projectId);
    const content = exportService.exportToCsv(...categorizedArticles(db, projectId));
    return saveExport(content, tabularTarget(projectId, 'Export Articles CSV', 'CSV Files', 'csv'));
  });
  handle(ipc, IpcChannel.EXPORT_XLSX, (_e, projectId: number) => {
    requireProject(db, projectId);
    const content = exportService.exportToXlsx(...categorizedArticles(db, projectId));
    return saveExport(content, tabularTarget(projectId, 'Export Articles XLSX', 'Excel Files', 'xlsx'));
  });
  handle(ipc, IpcChannel.EXPORT_BIBLIOSHINY, (_e, projectId: number) => {
    const project = requireProject(db, projectId);
    const content = exportService.exportToBiblioshiny(db.getArticlesByProject(projectId));
    return saveExport(content, {
      title: 'Exportar para Biblioshiny',
      defaultPath: `${project.name}_biblioshiny.csv`,
      filterName: 'CSV Files',
      extension: 'csv',
    });
  });
}

function requireProject(db: DatabaseAdapter, projectId: number): Project {
  const project = db.getProject(projectId);
  if (!project) {
    throw new Error(
      `[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=${projectId}. Expected shape: ID numérico de projeto cadastrado.`,
    );
  }
  return project;
}

function categorizedArticles(db: DatabaseAdapter, projectId: number) {
  return [
    db.getArticlesByProject(projectId),
    db.getProjectCategories(projectId),
    db.getAllProjectArticleCategories(projectId),
  ] as const;
}

function tabularTarget(projectId: number, title: string, filterName: string, extension: string): SaveTarget {
  return { title, defaultPath: `project_${projectId}_export.${extension}`, filterName, extension };
}

// E2E runs set E2E_MOCK_SAVE_FILE_PATH because native save dialogs cannot be driven by Playwright.
async function saveExport(content: string | Buffer, target: SaveTarget): Promise<string | null> {
  const e2ePath = process.env.E2E_MOCK_SAVE_FILE_PATH;
  if (e2ePath) {
    fs.writeFileSync(e2ePath, content);
    return e2ePath;
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: target.title,
    defaultPath: target.defaultPath,
    filters: [{ name: target.filterName, extensions: [target.extension] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content);
  return filePath;
}
