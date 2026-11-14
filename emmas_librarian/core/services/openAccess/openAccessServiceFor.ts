import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import type { LibraryStorage } from '../LibraryStorage';
import { openAccessHttpClientFor } from './e2eMockHttpClient';
import { OpenAccessService } from './OpenAccessService';

/**
 * The open access service the app uses: real network (or the E2E mock when the environment asks for it),
 * with PDFs saved to the library through `storage`.
 *
 * Usage:
 *   registerPdfHandlers(ipcMain, db, storage, openAccessServiceFor(db, storage, process.env));
 */
export function openAccessServiceFor(
  db: DatabaseAdapter,
  storage: Pick<LibraryStorage, 'savePdfBytes'>,
  env: NodeJS.ProcessEnv,
): OpenAccessService {
  return new OpenAccessService({
    db,
    http: openAccessHttpClientFor(env),
    storePdf: (bytes, name) => storage.savePdfBytes(bytes, name),
  });
}
