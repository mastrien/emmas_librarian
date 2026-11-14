import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import { ScientificVenueRepository } from '../database/ScientificVenueRepository';
import { SyncService } from '../database/SyncService';
import type { AppPaths } from '../ports/AppPaths';
import type { AppRuntime } from '../ports/AppRuntime';
import { AIService } from '../services/AIService';
import { BackupService } from '../services/BackupService';
import { apiIntegratorFor } from '../services/E2eMockApiIntegrator';
import { ExportService } from '../services/ExportService';
import { LibraryStorage } from '../services/LibraryStorage';
import { QueryTranslator } from '../services/QueryTranslator';
import { SearchMonitorService } from '../services/SearchMonitorService';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { openAccessServiceFor } from '../services/openAccess/openAccessServiceFor';
import { e2eAskModels } from '../services/projectQuestion/e2eAskModels';
import { e2eScreeningModel } from '../services/screening/e2eScreeningModel';
import { CommandRegistry } from './CommandRegistry';
import { registerAgendaCommands } from './agendaCommands';
import { registerAiCommands } from './aiCommands';
import { registerAnnotationCommands } from './annotationCommands';
import { registerArticleCommands } from './articleCommands';
import { registerAuditCommands } from './auditCommands';
import { registerBackupCommands } from './backupCommands';
import { registerCategoryAndInvestigationCommands } from './categoryCommands';
import { registerDiaryAndTrashCommands } from './diaryCommands';
import { registerDocumentCommands } from './documentCommands';
import { registerExportCommands } from './exportCommands';
import { registerPdfCommands } from './pdfCommands';
import { registerPrismaCommands } from './prismaCommands';
import { registerProjectCommands, registerSearchCommands } from './projectCommands';
import { registerProjectQuestionCommands } from './projectQuestionCommands';
import { registerScreeningCommands } from './screeningCommands';
import { registerScreeningOrderCommands } from './screeningOrderCommands';
import { registerScreeningSuggestionCommands } from './screeningSuggestionCommands';
import { registerSearchMonitorCommands } from './searchMonitorCommands';
import { registerSettingsCommands } from './settingsCommands';

/** What the process running the library gives it: where it lives, how to restart, and its environment. */
export interface LibraryHost {
  paths: AppPaths;
  runtime: AppRuntime;
  /** E2E_MOCK_* switches swap the network and the AI providers for canned answers. */
  env: Record<string, string | undefined>;
}

export interface LibraryCommands {
  commands: CommandRegistry;
  /** Exposed so a shell can run the daily backup when it starts. */
  autoBackups: BackupService;
}

/**
 * Composition root of the core: builds the services over an open library and registers every command
 * a shell can expose. The desktop app, the CLI and the LAN server all start here (epic #27).
 *
 * Usage:
 *   const { commands } = buildLibraryCommands(db, { paths: appPathsIn(userData), runtime, env: process.env });
 *   await commands.run(IpcChannel.PROJECTS_GET_ALL);
 */
export function buildLibraryCommands(db: DatabaseAdapter, host: LibraryHost): LibraryCommands {
  const commands = new CommandRegistry();
  const autoBackups = registerFileCommands(commands, db, host);
  registerRecordCommands(commands, db);
  registerSearchingCommands(commands, db, host.env);
  registerAiBackedCommands(commands, db, host);
  return { commands, autoBackups };
}

// Everything that reads or writes files of the library: stored PDFs and documents, exports, backups.
function registerFileCommands(commands: CommandRegistry, db: DatabaseAdapter, host: LibraryHost): BackupService {
  const { paths, runtime, env } = host;
  const storage = new LibraryStorage(db, paths);
  const autoBackups = new BackupService(db, paths.dbPath, paths.backupsDir, () => runtime.restart());
  registerArticleCommands(commands, db, storage);
  registerPdfCommands(commands, db, storage, openAccessServiceFor(db, storage, env));
  registerDocumentCommands(commands, db, storage);
  registerExportCommands(commands, db, new ExportService());
  registerPrismaCommands(commands, db);
  const sync = new SyncService(db, paths, runtime);
  registerBackupCommands(commands, { sync, backups: autoBackups, appVersion: runtime.version });
  return autoBackups;
}

// Plain reads and writes of the library's records.
function registerRecordCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  registerProjectCommands(commands, db);
  registerSettingsCommands(commands, db);
  registerAnnotationCommands(commands, db);
  registerAuditCommands(commands, db);
  registerScreeningCommands(commands, db);
  registerDiaryAndTrashCommands(commands, db);
  registerCategoryAndInvestigationCommands(commands, db);
  registerAgendaCommands(commands, new ScientificVenueRepository(db.getDB()));
}

function registerSearchingCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  env: Record<string, string | undefined>,
): void {
  // E2E runs must not hit the real bibliographic APIs.
  const orchestrator = new SearchOrchestrator(db, new QueryTranslator(), apiIntegratorFor(env));
  registerSearchCommands(commands, db, orchestrator);
  registerSearchMonitorCommands(commands, db, new SearchMonitorService(db, new QueryTranslator(), orchestrator));
}

// The models are asked for on each call, because the settings can change between them.
function registerAiBackedCommands(commands: CommandRegistry, db: DatabaseAdapter, host: LibraryHost): void {
  const aiService = new AIService(db, host.paths.modelsDir);
  const mocked = host.env.E2E_MOCK_AI_ASK === 'true';
  const askModels = () => (mocked ? e2eAskModels() : aiService.askModels());
  registerAiCommands(commands, db, aiService, host.env);
  registerProjectQuestionCommands(commands, db, askModels);
  registerScreeningOrderCommands(commands, db, askModels);
  registerScreeningSuggestionCommands(commands, db, () => (mocked ? e2eScreeningModel() : aiService.screeningModel()));
}
