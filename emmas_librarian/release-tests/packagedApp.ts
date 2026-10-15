import path from 'path';

/**
 * The executable electron-builder leaves in `release/<os>-unpacked`: the exact files the installer packs.
 * Running it before publishing tests what users will get, native modules included.
 *
 * Usage:
 *   electron.launch({ executablePath: unpackedExecutable(process.platform, path.join(__dirname, '..', 'release')) });
 */
export function unpackedExecutable(platform: NodeJS.Platform, releaseDir: string): string {
  if (platform === 'win32') return path.join(releaseDir, 'win-unpacked', "Emma's Librarian.exe");
  if (platform === 'linux') return path.join(releaseDir, 'linux-unpacked', 'emmas-librarian');
  throw new Error(
    `[ERR_RELEASE_TEST_PLATFORM] No unpacked build known for platform "${platform}". Expected "win32" or "linux".`,
  );
}
