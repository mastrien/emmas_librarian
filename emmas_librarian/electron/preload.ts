import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  getPathForFile: (file: File & { path?: string }) => {
    if (webUtils && webUtils.getPathForFile) {
      return webUtils.getPathForFile(file);
    }
    return file.path || '';
  },
});
