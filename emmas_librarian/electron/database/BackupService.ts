import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { dialog, app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseAdapter } from './DatabaseAdapter';
import { mergeBackupProjects, type StorageDirs } from './backup/backupMerge';

const BACKUP_FILTERS = [{ name: "Emma's Librarian Backup", extensions: ['emmabak'] }];
const STORAGE_FOLDERS = ['storage/pdfs', 'storage/project_documents'];
const INVALID_BACKUP = 'Arquivo de backup inválido (não contém emma.db)';

/** Opens a database file with the app's schema and migrations applied. */
export type BackupDatabaseOpener = (dbPath: string) => DatabaseAdapter;

const userDataPath = (...segments: string[]) => path.join(app.getPath('userData'), ...segments);

const storageDirs = (): StorageDirs => ({
  pdfs: userDataPath('storage', 'pdfs'),
  documents: userDataPath('storage', 'project_documents'),
});

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

function readBackupDatabase(zip: AdmZip): Buffer {
  const entry = zip.getEntry('emma.db');
  if (!entry) throw new Error(INVALID_BACKUP);
  return entry.getData();
}

/**
 * Full-app backups (.emmabak zip with emma.db, PDFs and project documents): export, restore by
 * overwriting everything, or merge the backup's projects into the current library.
 *
 * Usage:
 *   const backups = new BackupService(dbAdapter);
 *   await backups.exportBackup();
 */
export class BackupService {
  constructor(
    private dbAdapter: DatabaseAdapter,
    private openBackupDatabase: BackupDatabaseOpener = (dbPath) => new DatabaseAdapter(dbPath),
  ) {}

  public async exportBackup(): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Backup Completo',
      defaultPath: `backup_${new Date().toISOString().split('T')[0]}.emmabak`,
      filters: BACKUP_FILTERS,
    });
    if (canceled || !filePath) return null;
    try {
      this.buildBackupZip().writeZip(filePath);
      return filePath;
    } catch (err) {
      console.error('Erro ao exportar backup:', err);
      throw err;
    }
  }

  private buildBackupZip(): AdmZip {
    const zip = new AdmZip();
    const dbPath = userDataPath('emma.db');
    // Flush the WAL into emma.db first so the copied file is complete.
    this.dbAdapter.checkpoint();
    if (fs.existsSync(dbPath)) zip.addFile('emma.db', fs.readFileSync(dbPath));
    for (const folder of STORAGE_FOLDERS) {
      const dir = userDataPath(...folder.split('/'));
      if (fs.existsSync(dir)) zip.addLocalFolder(dir, folder);
    }
    zip.addFile('backup_metadata.json', Buffer.from(JSON.stringify(this.backupMetadata(), null, 2), 'utf-8'));
    return zip;
  }

  private backupMetadata() {
    const db = this.dbAdapter.getDB();
    const count = (table: string) =>
      (db.prepare(`SELECT count(*) as count FROM ${table} WHERE deleted_at IS NULL`).get() as { count: number }).count;
    return {
      date: new Date().toISOString(),
      version: app.getVersion(),
      projectCount: count('projects'),
      articleCount: count('articles'),
    };
  }

  private async pickBackupFile(title: string, providedPath?: string): Promise<string | null> {
    if (providedPath) return providedPath;
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title,
      filters: BACKUP_FILTERS,
      properties: ['openFile'],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  }

  /** Replaces the whole library with the backup and relaunches the app. */
  public async restoreBackupOverride(providedPath?: string): Promise<boolean> {
    const importPath = await this.pickBackupFile('Restaurar Backup Completo (Sobrescrever)', providedPath);
    if (!importPath) return false;
    try {
      const zip = new AdmZip(importPath);
      const dbData = readBackupDatabase(zip);
      this.dbAdapter.checkpoint();
      this.dbAdapter.close();
      this.overwriteDatabase(dbData);
      this.extractStorage(zip);
      app.relaunch();
      app.exit(0);
      return true;
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      throw err;
    }
  }

  private overwriteDatabase(dbData: Buffer): void {
    const dbPath = userDataPath('emma.db');
    // Leftover WAL/SHM files from the old database would be replayed over the restored one.
    for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
    fs.writeFileSync(dbPath, dbData);
  }

  private extractStorage(zip: AdmZip): void {
    const baseDir = app.getPath('userData');
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !STORAGE_FOLDERS.some((folder) => entry.entryName.startsWith(`${folder}/`))) continue;
      const dest = path.join(baseDir, entry.entryName);
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, entry.getData());
    }
  }

  /** Imports the backup's projects whose names are not in use yet. Returns how many were imported. */
  public async restoreBackupMerge(providedPath?: string): Promise<number> {
    const importPath = await this.pickBackupFile('Importar e Mesclar Backup', providedPath);
    if (!importPath) return 0;
    const tempDir = userDataPath('temp_restore_' + uuidv4());
    let backupDb: DatabaseAdapter | null = null;
    try {
      const zip = new AdmZip(importPath);
      const tempDbPath = path.join(tempDir, 'temp_emma.db');
      ensureDir(tempDir);
      fs.writeFileSync(tempDbPath, readBackupDatabase(zip));
      // Opening it like the app database runs the same migrations, so older backups match the current schema.
      backupDb = this.openBackupDatabase(tempDbPath);
      const storage = storageDirs();
      Object.values(storage).forEach(ensureDir);
      return mergeBackupProjects(this.dbAdapter.getDB(), backupDb.getDB(), zip, storage);
    } catch (err) {
      console.error('Erro ao mesclar backup:', err);
      throw err;
    } finally {
      closeQuietly(backupDb);
      removeQuietly(tempDir);
    }
  }
}

function closeQuietly(db: DatabaseAdapter | null): void {
  try {
    db?.close();
  } catch (e) {
    console.error('Erro ao fechar tempDb:', e);
  }
}

function removeQuietly(dir: string): void {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.error('Erro ao deletar pasta temporária:', e);
  }
}
