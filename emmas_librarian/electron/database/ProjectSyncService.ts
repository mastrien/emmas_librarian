import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { dialog, app } from 'electron';
import { DatabaseAdapter } from './DatabaseAdapter';
import { readProjectRows, type ProjectRows } from './backup/projectRows';
import { insertProjectRows } from './backup/projectImport';

const PROJECT_FILTERS = [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }];
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
 * Usage:
 *   const sync = new ProjectSyncService(dbAdapter);
 *   await sync.exportProject(3);
 */
export class ProjectSyncService {
  constructor(private dbAdapter: DatabaseAdapter) {}

  public async exportProject(projectId: number): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Projeto',
      defaultPath: `projeto_${projectId}.emmapcarc`,
      filters: PROJECT_FILTERS,
    });
    if (canceled || !filePath) return null;
    try {
      const rows = readProjectRows(this.dbAdapter.getDB(), projectId, { includeGlobalQuestionSets: true });
      if (!rows) throw new Error(`Projeto não encontrado (id ${projectId})`);
      const zip = new AdmZip();
      zip.addFile('project.json', Buffer.from(JSON.stringify(rows, null, 2), 'utf-8'));
      addStoredFiles(zip, rows.articles, PDF_FOLDER);
      addStoredFiles(zip, rows.projectDocs, DOCUMENT_FOLDER);
      zip.writeZip(filePath);
      return filePath;
    } catch (err) {
      console.error('Erro ao exportar:', err);
      throw err;
    }
  }

  /** Imports a .emmapcarc as a new "<name> (Importado)" project and returns its id. */
  public async importProject(providedPath?: string): Promise<number | null> {
    const importPath = providedPath ?? (await this.pickProjectFile());
    if (!importPath) return null;
    try {
      const zip = new AdmZip(importPath);
      const rows = readProjectJson(zip);
      const userData = app.getPath('userData');
      const files = {
        zip,
        pdfFolder: PDF_FOLDER,
        documentFolder: DOCUMENT_FOLDER,
        pdfDir: ensureDir(path.join(userData, 'storage', 'pdfs')),
        documentDir: ensureDir(path.join(userData, 'storage', 'project_documents')),
      };
      return insertProjectRows(this.dbAdapter.getDB(), rows, files, `${rows.project.name} (Importado)`);
    } catch (err) {
      console.error('Erro ao importar:', err);
      throw err;
    }
  }

  private async pickProjectFile(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Importar Projeto',
      filters: PROJECT_FILTERS,
      properties: ['openFile'],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  }
}

function readProjectJson(zip: AdmZip): ProjectRows {
  const entry = zip.getEntry('project.json');
  if (!entry) throw new Error('Arquivo de projeto inválido (.emmapcarc não contém project.json)');
  return JSON.parse(entry.getData().toString('utf8')) as ProjectRows;
}
