import { BrowserWindow } from 'electron';
import { handle, type IpcRegistrar } from './handle';

const TITLE_BAR_COLORS = {
  dark: { color: '#0f172a', symbolColor: '#e2e8f0' },
  light: { color: '#f8fafc', symbolColor: '#334155' },
};

/**
 * Keeps the native title bar overlay in sync with the renderer theme.
 *
 * Usage:
 *   registerWindowHandlers(ipcMain);
 */
export function registerWindowHandlers(ipc: IpcRegistrar): void {
  handle(ipc, 'UPDATE_TITLE_BAR', (event, theme: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.setTitleBarOverlay(theme === 'dark' ? TITLE_BAR_COLORS.dark : TITLE_BAR_COLORS.light);
  });
}
