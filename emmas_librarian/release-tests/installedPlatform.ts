import { linuxInstall } from './linuxInstall';
import type { InstalledAppPlatform } from './platformTypes';
import { windowsInstall } from './windowsInstall';

/**
 * The release-test platform for this operating system (Windows: NSIS; Linux: AppImage, issue #17).
 *
 * Usage:
 *   const platform = installedAppPlatform(process.platform, process.env, '/tmp/emma-app');
 */
export function installedAppPlatform(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  installDir: string,
): InstalledAppPlatform {
  if (platform === 'win32') return windowsInstall(env, installDir);
  if (platform === 'linux') return linuxInstall(env, installDir);
  throw new Error(`[ERR_RELEASE_TEST_PLATFORM] No release test for platform "${platform}". Expected win32 or linux.`);
}
