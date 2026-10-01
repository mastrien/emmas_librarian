import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { savePdfBytesToStorage } from '../../ipc/handlers/pdfStorage';
import { openAccessHttpClientFor } from './e2eMockHttpClient';
import { OpenAccessService } from './OpenAccessService';

/**
 * The open access service the app uses: real network (or the E2E mock when the environment asks for it),
 * with PDFs saved to the library of `db`.
 *
 * Usage:
 *   registerPdfHandlers(ipcMain, db, openAccessServiceFor(db, process.env));
 */
export function openAccessServiceFor(db: DatabaseAdapter, env: NodeJS.ProcessEnv): OpenAccessService {
  return new OpenAccessService({
    db,
    http: openAccessHttpClientFor(env),
    storePdf: (bytes, name) => savePdfBytesToStorage(db, bytes, name),
  });
}
