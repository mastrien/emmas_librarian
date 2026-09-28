/**
 * The disk path of a file dropped or picked in the renderer. Electron 32+ removed File.path, so the sandboxed
 * renderer gets it only through the preload's getPathForFile; `path` and the bare name are fallbacks for
 * environments without the bridge.
 *
 * Usage:
 *   const filePath = droppedFilePath(event.dataTransfer.files[0]);
 */
export function droppedFilePath(file: File): string {
  if (window.electronAPI?.getPathForFile) return window.electronAPI.getPathForFile(file);
  return (file as File & { path?: string }).path || file.name;
}
