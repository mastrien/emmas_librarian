import AdmZip, { type IZipEntry } from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseAdapter } from './DatabaseAdapter';
import { writeArchive } from './backup/archiveFile';
import { mergeBackupProjects, type StorageDirs } from './backup/backupMerge';
import { rebaseStoredPaths } from './backup/storedPaths';
import type { AppPaths } from '../ports/AppPaths';
import type { AppRuntime } from '../ports/AppRuntime';

const STORAGE_FOLDERS = ['storage/pdfs', 'storage/project_documents'];
const INVALID_BACKUP = 'Arquivo de backup inválido (não contém emma.db)';

/** Opens a database file with the app's schema and migrations applied. */
export type BackupDatabaseOpener = (dbPath: string) => DatabaseAdapter;

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
 * The file to write or read is always given by the caller: asking the user for it is the shell's job.
 *
 * Usage:
 *   const backups = new BackupService(dbAdapter, appPathsIn(userData), runtime);
 *   await backups.exportBackup('/home/ana/backup_2026-11-14.emmabak');
 */
export class BackupService {
  constructor(
    private dbAdapter: DatabaseAdapter,
    private paths: AppPaths,
    private runtime: AppRuntime,
    private openBackupDatabase: BackupDatabaseOpener = (dbPath) => new DatabaseAdapter(dbPath),
  ) {}

  private storageDirs(): StorageDirs {
    return { pdfs: this.paths.pdfsDir, documents: this.paths.documentsDir };
  }

  /** Writes the whole library to `filePath` and returns it. */
  public async exportBackup(filePath: string): Promise<string> {
    try {
      writeArchive(this.buildBackupZip(), filePath);
      return filePath;
    } catch (err) {
      console.error('Erro ao exportar backup:', err);
      throw err;
    }
  }

  private buildBackupZip(): AdmZip {
    const zip = new AdmZip();
    const { dbPath } = this.paths;
    // Flush the WAL into emma.db first so the copied file is complete.
    this.dbAdapter.checkpoint();
    if (fs.existsSync(dbPath)) zip.addFile('emma.db', fs.readFileSync(dbPath));
    for (const folder of STORAGE_FOLDERS) {
      const dir = path.join(this.paths.userData, ...folder.split('/'));
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
      version: this.runtime.version,
      projectCount: count('projects'),
      articleCount: count('articles'),
    };
  }

  /** Replaces the whole library with the backup and relaunches the app. */
  public async restoreBackupOverride(importPath: string): Promise<boolean> {
    try {
      const zip = new AdmZip(importPath);
      const dbData = readBackupDatabase(zip);
      // Checked before anything is touched, so a tampered archive leaves the library as it was.
      const storedFiles = storageEntries(zip, this.paths.userData);
      this.dbAdapter.checkpoint();
      this.dbAdapter.close();
      this.overwriteDatabase(dbData);
      writeStoredFiles(storedFiles);
      this.rebaseRestoredPaths();
      this.runtime.restart();
      return true;
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      throw err;
    }
  }

  private overwriteDatabase(dbData: Buffer): void {
    const { dbPath } = this.paths;
    // Leftover WAL/SHM files from the old database would be replayed over the restored one.
    for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
    fs.writeFileSync(dbPath, dbData);
  }

  // The restored database may come from another computer: point its file links at this userData folder.
  private rebaseRestoredPaths(): void {
    const restored = this.openBackupDatabase(this.paths.dbPath);
    try {
      rebaseStoredPaths(restored.getDB(), this.storageDirs());
    } finally {
      restored.close();
    }
  }

  /** Imports the backup's projects whose names are not in use yet and returns how many were imported. */
  public async restoreBackupMerge(importPath: string): Promise<number> {
    const tempDir = path.join(this.paths.userData, 'temp_restore_' + uuidv4());
    let backupDb: DatabaseAdapter | null = null;
    try {
      const zip = new AdmZip(importPath);
      const tempDbPath = path.join(tempDir, 'temp_emma.db');
      ensureDir(tempDir);
      fs.writeFileSync(tempDbPath, readBackupDatabase(zip));
      // Opening it like the app database runs the same migrations, so older backups match the current schema.
      backupDb = this.openBackupDatabase(tempDbPath);
      const storage = this.storageDirs();
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

interface StoredFileEntry {
  entry: IZipEntry;
  dest: string;
}

/** The archive's PDFs and documents with where each one goes under `baseDir`. */
function storageEntries(zip: AdmZip, baseDir: string): StoredFileEntry[] {
  return zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && STORAGE_FOLDERS.some((f) => entry.entryName.startsWith(`${f}/`)))
    .map((entry) => ({ entry, dest: destinationInside(baseDir, entry.entryName) }));
}

// "Zip slip": AdmZip keeps "../" in names read from archives made by other tools; path.join would follow it.
function destinationInside(baseDir: string, entryName: string): string {
  const dest = path.resolve(baseDir, entryName);
  const inside = STORAGE_FOLDERS.some((f) => dest.startsWith(path.resolve(baseDir, f) + path.sep));
  if (inside) return dest;
  throw new Error(
    `[ERR_INVALID_BACKUP] Arquivo de backup inválido: a entrada "${entryName}" sai das pastas de armazenamento. ` +
      `Expected shape: caminhos dentro de ${STORAGE_FOLDERS.join(' ou ')}.`,
  );
}

function writeStoredFiles(files: StoredFileEntry[]): void {
  for (const { entry, dest } of files) {
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, entry.getData());
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
