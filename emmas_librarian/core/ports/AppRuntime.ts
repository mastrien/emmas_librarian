/**
 * Port for what the core asks of the process hosting it. The desktop app answers with Electron's
 * `app`; a CLI answers with its own version and, having no window to reopen, an exit.
 */
export interface AppRuntime {
  /** Version of the app, written into the metadata of full backups. */
  version: string;
  /** Restarts the host so it reopens a library file that was just replaced on disk (backup restores). */
  restart(): void;
}
