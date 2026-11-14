import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  // Returns the unsubscribe: a component that listens must stop when it unmounts.
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  getPathForFile: (file: File & { path?: string }) => {
    if (webUtils && webUtils.getPathForFile) {
      return webUtils.getPathForFile(file);
    }
    return file.path || '';
  },
});
