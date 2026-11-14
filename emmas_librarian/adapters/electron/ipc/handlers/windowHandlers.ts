import { BrowserWindow } from 'electron';
import { handle, type IpcRegistrar } from './handle';

export interface TitleBarColors {
  color: string;
  symbolColor: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const isHex = (value: unknown): value is string => typeof value === 'string' && HEX_COLOR.test(value);

/**
 * Checks the colours the renderer sends for the title bar overlay. They come from the page's own tokens, so the bar
 * follows any tone (Arca 134) without a second colour table here.
 *
 * @example parseTitleBarColors({ color: '#141416', symbolColor: '#e4e4e7' })
 */
export function parseTitleBarColors(value: unknown): TitleBarColors {
  const colors = (value ?? {}) as Record<string, unknown>;
  if (!isHex(colors.color) || !isHex(colors.symbolColor)) {
    throw new Error(
      `Cores da barra de título inválidas: ${JSON.stringify(value)}; esperado { color: "#rrggbb", symbolColor: "#rrggbb" }`,
    );
  }
  return { color: colors.color, symbolColor: colors.symbolColor };
}

/**
 * Keeps the native title bar overlay in sync with the renderer theme and tone.
 *
 * Usage:
 *   registerWindowHandlers(ipcMain);
 */
export function registerWindowHandlers(ipc: IpcRegistrar): void {
  handle(ipc, 'UPDATE_TITLE_BAR', (event, colors: unknown) => {
    const parsed = parseTitleBarColors(colors);
    BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay(parsed);
  });
}
