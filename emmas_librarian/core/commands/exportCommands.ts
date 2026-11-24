import fs from 'fs';
import { IpcChannel, type Project, type SearchHistoryItem } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { ExportService } from '../services/ExportService';
import {
  searchReportMarkdown,
  searchReportRows,
  searchReportXlsx,
  type SearchReportFormat,
} from '../services/SearchReportService';
import type { CommandRegistry, FileArgument, FileSuggestion } from './CommandRegistry';

/** The kind of file an export writes, as a save dialog or a CLI help text names it. */
export interface ExportFileType {
  filterName: string;
  extension: string;
}

/**
 * Describes the file an export writes.
 *
 * Usage:
 *   exportFile('Exportar diagrama PRISMA', 'Tese_prisma.svg', { filterName: 'Imagem SVG', extension: 'svg' });
 */
export function exportFile(title: string, defaultPath: string, type: ExportFileType): FileSuggestion {
  return { title, defaultPath, filters: [{ name: type.filterName, extensions: [type.extension] }] };
}

/**
 * Writes an export to the file the shell was given and answers its path.
 *
 * Usage:
 *   return writeExport(csvText, filePath);
 */
export function writeExport(content: string | Buffer, filePath: string): string {
  fs.writeFileSync(filePath, content);
  return filePath;
}

const CSV: ExportFileType = { filterName: 'CSV Files', extension: 'csv' };
const XLSX: ExportFileType = { filterName: 'Excel Files', extension: 'xlsx' };

/**
 * Project exports to CSV, XLSX and the Scopus-style CSV that Biblioshiny reads. Each command takes the
 * file to write as its last argument; the project is checked before anyone is asked for that file.
 *
 * Usage:
 *   registerExportCommands(commands, db, new ExportService());
 */
export function registerExportCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  exportService: ExportService,
): void {
  const tabular = (title: string, type: ExportFileType) => (projectId: number) => {
    requireProject(db, projectId);
    return exportFile(title, `project_${projectId}_export.${type.extension}`, type);
  };
  commands.add(
    IpcChannel.EXPORT_CSV,
    (projectId: number, filePath: string) =>
      writeExport(exportService.exportToCsv(...categorizedArticles(db, projectId)), filePath),
    { file: savedAt(1, tabular('Export Articles CSV', CSV)) },
  );
  commands.add(
    IpcChannel.EXPORT_XLSX,
    (projectId: number, filePath: string) =>
      writeExport(exportService.exportToXlsx(...categorizedArticles(db, projectId)), filePath),
    { file: savedAt(1, tabular('Export Articles XLSX', XLSX)) },
  );
  registerBiblioshinyCommand(commands, db, exportService);
  registerSearchReportCommand(commands, db);
}

/**
 * The file argument of a command that writes its result to the path at position `at`.
 *
 * Usage:
 *   commands.add(name, (projectId: number, filePath: string) => ..., { file: savedAt(1, describe) });
 */
export function savedAt(at: number, describe: FileArgument['describe']): FileArgument {
  return { at, mode: 'save', describe };
}

function registerBiblioshinyCommand(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  exportService: ExportService,
): void {
  const describe = (projectId: number) =>
    exportFile('Exportar para Biblioshiny', `${requireProject(db, projectId).name}_biblioshiny.csv`, CSV);
  commands.add(
    IpcChannel.EXPORT_BIBLIOSHINY,
    (projectId: number, filePath: string) => {
      requireProject(db, projectId);
      return writeExport(exportService.exportToBiblioshiny(db.getArticlesByProject(projectId)), filePath);
    },
    { file: savedAt(1, describe) },
  );
}

const REPORT_TYPES: Record<SearchReportFormat, ExportFileType> = {
  xlsx: XLSX,
  md: { filterName: 'Markdown', extension: 'md' },
};

function requireReportFormat(format: unknown): SearchReportFormat {
  if (format === 'xlsx' || format === 'md') return format;
  throw new Error(
    `[ERR_INVALID_FORMAT] Formato de relatório inválido. Offending value: format=${JSON.stringify(format)}. Expected shape: "xlsx" ou "md".`,
  );
}

// #45: the search strategy (one row per base and run, with each query as sent) as XLSX or Markdown.
function registerSearchReportCommand(commands: CommandRegistry, db: DatabaseAdapter): void {
  const describe = (projectId: number, rawFormat: unknown) => {
    const project = requireProject(db, projectId);
    const type = REPORT_TYPES[requireReportFormat(rawFormat)];
    return exportFile('Exportar estratégia de busca', `${project.name}_estrategia_de_busca.${type.extension}`, type);
  };
  commands.add(
    IpcChannel.EXPORT_SEARCH_REPORT,
    (projectId: number, rawFormat: unknown, filePath: string) => {
      const project = requireProject(db, projectId);
      const rows = searchReportRows(db.getSearchHistory(projectId) as SearchHistoryItem[]);
      const asMarkdown = requireReportFormat(rawFormat) === 'md';
      const content = asMarkdown ? searchReportMarkdown(rows, project.name, new Date()) : searchReportXlsx(rows);
      return writeExport(content, filePath);
    },
    { file: savedAt(2, describe) },
  );
}

export function requireProject(db: DatabaseAdapter, projectId: number): Project {
  const project = db.getProject(projectId);
  if (!project) {
    throw new Error(
      `[ERR_NOT_FOUND] Projeto não encontrado. Offending value: projectId=${projectId}. Expected shape: ID numérico de projeto cadastrado.`,
    );
  }
  return project;
}

function categorizedArticles(db: DatabaseAdapter, projectId: number) {
  requireProject(db, projectId);
  return [
    db.getArticlesByProject(projectId),
    db.getProjectCategories(projectId),
    db.getAllProjectArticleCategories(projectId),
    db.getScreeningExportRows(projectId),
  ] as const;
}
