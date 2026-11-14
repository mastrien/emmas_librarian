import type { AppRuntime } from '../../AppRuntime';

/**
 * Host process for tests: a fixed version, and `restarts` counts how often the core asked to restart.
 *
 * Usage:
 *   const runtime = new FakeAppRuntime();
 *   await new BackupService(db, paths, runtime).restoreBackupOverride(file);
 *   expect(runtime.restarts).toBe(1);
 */
export class FakeAppRuntime implements AppRuntime {
  restarts = 0;

  constructor(public version = '9.9.9') {}

  restart(): void {
    this.restarts += 1;
  }
}
