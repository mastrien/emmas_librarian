import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { InstalledAppPlatform } from './platformTypes';

// A fixed name without the version: electron-updater replaces the AppImage at $APPIMAGE in place, so the
// update-flow test finds the new version where the old one was.
const APP_FILE = 'emmas-librarian.AppImage';
// The app's process name: linux.executableName in package.json.
const PROCESS_NAME = 'emmas-librarian';

/**
 * The installed app on Linux: an AppImage in `installDir`, the library under $XDG_CONFIG_HOME (default
 * ~/.config)/<package name>, processes found and signalled with pgrep/pkill.
 *
 * Usage:
 *   const platform = linuxInstall(process.env, '/tmp/emma-app');
 *   platform.install('release/emmas-librarian-1.3.0-x86_64.AppImage');
 */
export function linuxInstall(env: NodeJS.ProcessEnv, installDir: string): InstalledAppPlatform {
  const appExecutable = path.join(installDir, APP_FILE);
  return {
    userData: path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'emmas_librarian'),
    appExecutable,
    updateMetadataFile: 'latest-linux.yml',
    installerExtension: '.AppImage',
    install: (appImage) => installAppImage(appImage, appExecutable),
    appIsRunning: () => spawnSync('pgrep', ['-x', PROCESS_NAME]).status === 0,
    // Electron quits on SIGTERM the way it does when the last window is closed.
    askAppToClose: () => void spawnSync('pkill', ['-TERM', '-x', PROCESS_NAME]),
    forceQuitApp: () => void spawnSync('pkill', ['-KILL', '-x', PROCESS_NAME]),
  };
}

/**
 * "Installing" an AppImage is putting the file in place, executable. A copy next to the target renamed over it,
 * as electron-updater does: copying straight onto an AppImage that is still running fails with ETXTBSY.
 *
 * Usage:
 *   installAppImage('release/emmas-librarian-1.3.0-x86_64.AppImage', '/tmp/emma-app/emmas-librarian.AppImage');
 */
export function installAppImage(appImage: string, target: string): void {
  if (!fs.existsSync(appImage)) {
    throw new Error(
      `[ERR_RELEASE_TEST_INSTALLER] AppImage not found: "${appImage}". Expected an electron-builder .AppImage.`,
    );
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staged = `${target}.new`;
  fs.copyFileSync(appImage, staged);
  fs.chmodSync(staged, 0o755);
  fs.renameSync(staged, target);
}
