import os from 'os';
import path from 'path';

export interface UserDataContext {
  isPackaged: boolean;
  isProductionEnv: boolean;
  argv: string[];
  env: Record<string, string | undefined>;
  cwd: string;
  pid: number;
}

// Playwright's electron.launch() adds --remote-debugging-port; Chromium test harnesses add --user-data-dir.
const isAutomatedLaunch = (argv: string[]) =>
  argv.some((arg) => arg.includes('--remote-debugging-port') || arg.includes('--user-data-dir'));

/**
 * Where the app should keep emma.db and stored files, or null for Electron's default
 * (%APPDATA%/<app>, the installed app's real library).
 * Automated (E2E) runs of an unpackaged build never get the default: they use E2E_USER_DATA_DIR
 * or a throwaway temp folder, so tests cannot touch a real library.
 *
 * Usage:
 *   const dir = resolveUserDataDir({ isPackaged: app.isPackaged, isProductionEnv, argv: process.argv, env: process.env, cwd: process.cwd(), pid: process.pid });
 *   if (dir) app.setPath('userData', dir);
 */
export function resolveUserDataDir(ctx: UserDataContext): string | null {
  if (ctx.env.E2E_USER_DATA_DIR) return ctx.env.E2E_USER_DATA_DIR;
  if (ctx.isPackaged || ctx.isProductionEnv) return null;
  if (isAutomatedLaunch(ctx.argv)) return path.join(os.tmpdir(), `emmas-librarian-e2e-${ctx.pid}`);
  return path.join(ctx.cwd, 'dev_data');
}

/** Whether this launch comes from an automated test harness (used to skip dev-only extras). */
export const isE2ELaunch = (argv: string[]): boolean => isAutomatedLaunch(argv);
