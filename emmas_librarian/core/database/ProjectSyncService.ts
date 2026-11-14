import AdmZip from 'adm-zip';
import fs from 'fs';
import { DatabaseAdapter } from './DatabaseAdapter';
import type { AppPaths } from '../ports/AppPaths';
import { writeArchive } from './backup/archiveFile';
import { readProjectRows, type ProjectRows } from './backup/projectRows';
import { insertProjectRows } from './backup/projectImport';
import { assertReadableProjectFormat, PROJECT_FORMAT_VERSION } from './backup/projectFileFormat';

const PDF_FOLDER = 'pdfs';
const DOCUMENT_FOLDER = 'docs';

const addStoredFiles = (zip: AdmZip, rows: { local_file_path?: unknown }[], folder: string) => {
  for (const row of rows) {
    const filePath = row.local_file_path ? String(row.local_file_path) : '';
    if (filePath && fs.existsSync(filePath)) zip.addLocalFile(filePath, folder);
  }
};

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Shares one project between installations as a .emmapcarc file (project.json + its PDFs and documents).
 *
 * The file to write or read is always given by the caller: asking the user for it is the shell's job.
 *
 * Usage:
 *   const sync = new ProjectSyncService(dbAdapter, appPathsIn(userData));
 *   await sync.exportProject(3, '/home/ana/tese.emmapcarc');
 */
export class ProjectSyncService {
  constructor(
    private dbAdapter: DatabaseAdapter,
    private paths: AppPaths,
  ) {}

  /** Writes the project to `filePath` and returns it. */
  public async exportProject(projectId: number, filePath: string): Promise<string> {
    try {
      const rows = readProjectRows(this.dbAdapter.getDB(), projectId, { includeGlobalQuestionSets: true });
      if (!rows) throw new Error(`Projeto não encontrado (id ${projectId})`);
      const zip = new AdmZip();
      zip.addFile('project.json', Buffer.from(projectJsonOf(rows), 'utf-8'));
      addStoredFiles(zip, rows.articles, PDF_FOLDER);
      addStoredFiles(zip, rows.projectDocs, DOCUMENT_FOLDER);
      writeArchive(zip, filePath);
      return filePath;
    } catch (err) {
      console.error('Erro ao exportar:', err);
      throw err;
    }
  }

  /** Imports a .emmapcarc as a new "<name> (Importado)" project and returns its id. */
  public async importProject(importPath: string): Promise<number> {
    try {
      const zip = new AdmZip(importPath);
      const rows = readProjectJson(zip);
      const files = {
        zip,
        pdfFolder: PDF_FOLDER,
        documentFolder: DOCUMENT_FOLDER,
        pdfDir: ensureDir(this.paths.pdfsDir),
        documentDir: ensureDir(this.paths.documentsDir),
      };
      return insertProjectRows(this.dbAdapter.getDB(), rows, files, `${rows.project.name} (Importado)`);
    } catch (err) {
      console.error('Erro ao importar:', err);
      throw err;
    }
  }
}

function readProjectJson(zip: AdmZip): ProjectRows {
  const entry = zip.getEntry('project.json');
  if (!entry) throw new Error('Arquivo de projeto inválido (.emmapcarc não contém project.json)');
  const rows = JSON.parse(entry.getData().toString('utf8')) as ProjectRows;
  assertReadableProjectFormat(rows);
  return rows;
}

// formatVersion goes first so a reader can decide how to read the rest before parsing it all (#30).
function projectJsonOf(rows: ProjectRows): string {
  return JSON.stringify({ formatVersion: PROJECT_FORMAT_VERSION, ...rows }, null, 2);
}
