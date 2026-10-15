import path from 'path';

/**
 * The window icon file for this platform. Windows takes the .ico; nativeImage cannot read .ico on Linux,
 * where the window (and the taskbar entry of an AppImage) would show no icon, so other platforms get a PNG.
 * Dev runs read from public/, packaged builds from dist/ (Vite copies public/ there).
 *
 * Usage:
 *   nativeImage.createFromPath(windowIconFile(app.getAppPath(), process.platform, isDev));
 */
export function windowIconFile(appPath: string, platform: NodeJS.Platform, isDev: boolean): string {
  const fileName = platform === 'win32' ? 'favicon.ico' : 'app-icon.png';
  return path.join(appPath, isDev ? 'public' : 'dist', fileName);
}
