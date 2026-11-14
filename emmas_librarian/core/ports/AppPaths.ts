import path from 'path';

/**
 * Port for where a library lives on disk. The core never asks the shell for a folder: it receives
 * these paths from whoever starts it (Electron's userData, a CLI flag, a test's temp dir).
 */
export interface AppPaths {
  /** Root folder of the library; everything else is inside it. */
  userData: string;
  dbPath: string;
  backupsDir: string;
  /** PDFs of the global library, shared between projects by content hash. */
  pdfsDir: string;
  /** Files attached as project documents. */
  documentsDir: string;
  /** Cache of the local embedding model. */
  modelsDir: string;
}

/**
 * The layout of a library inside `userData`; shared by the normal startup, the recovery that runs
 * when that startup fails, and every other shell.
 *
 * Usage:
 *   const { dbPath, backupsDir } = appPathsIn(app.getPath('userData'));
 */
export function appPathsIn(userData: string): AppPaths {
  const storage = path.join(userData, 'storage');
  return {
    userData,
    dbPath: path.join(userData, 'emma.db'),
    backupsDir: path.join(userData, 'backups'),
    pdfsDir: path.join(storage, 'pdfs'),
    documentsDir: path.join(storage, 'project_documents'),
    modelsDir: path.join(userData, 'models'),
  };
}
