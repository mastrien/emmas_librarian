import fs from 'fs';
import { buildLibraryCommands } from '../commands/libraryCommands';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { AppError } from '../errors/AppError';
import type { AppPaths } from '../ports/AppPaths';
import type { SecretStore } from '../ports/SecretStore';
import { isAppRunningOn, type ProcessProbe } from './appRunningMarker';
import type { OpenedCliHost } from './cliRunner';

export interface CliLibraryHost {
  paths: AppPaths;
  secrets: SecretStore;
  appVersion: string;
  env: Record<string, string | undefined>;
  /** Replaced in tests; the default asks the operating system. */
  alive?: ProcessProbe;
}

function requireLibrary(paths: AppPaths): void {
  if (fs.existsSync(paths.dbPath)) return;
  throw new AppError(
    'ERR_LIBRARY_NOT_FOUND',
    'USER_ERROR',
    `[ERR_LIBRARY_NOT_FOUND] Nenhuma biblioteca encontrada. Offending value: "${paths.dbPath}". Expected shape: uma pasta com emma.db; abra o aplicativo uma vez ou aponte a pasta com --data-dir.`,
  );
}

/**
 * Opens an existing library for one CLI run. It never creates one: a wrong folder must be an error,
 * not a new empty library. Nothing restarts after a restore, since the process ends with the command.
 *
 * Usage:
 *   const host = openCliLibrary({ paths: appPathsIn(dir), secrets, appVersion: '1.4.0', env: process.env });
 *   try { await runCliRequest(request, host); } finally { host.close(); }
 */
export function openCliLibrary(host: CliLibraryHost): OpenedCliHost {
  const { paths, secrets, appVersion, env, alive } = host;
  requireLibrary(paths);
  const db = new DatabaseAdapter(paths.dbPath, secrets);
  const runtime = { version: appVersion, restart: () => undefined };
  const { commands } = buildLibraryCommands(db, { paths, runtime, env });
  return { commands, isAppRunning: () => isAppRunningOn(paths.userData, alive), close: () => closeOnce(db) };
}

// A restore that replaces the library closes the database itself; closing twice must not fail the run.
function closeOnce(db: DatabaseAdapter): void {
  try {
    db.close();
  } catch {
    // Already closed by the command.
  }
}
