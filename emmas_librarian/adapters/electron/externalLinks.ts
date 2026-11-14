/** The slice of Electron's WebContents the link guard needs (so tests can use a named fake). */
export interface LinkGuardContents {
  on(event: 'will-navigate', listener: (event: { preventDefault(): void }, url: string) => void): void;
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void;
}

const WEB_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * True for a link that must open in the person's browser: a web or mail address that is not the app's own page.
 * Anything else (file://, custom schemes, junk) is never handed to the operating system.
 *
 * @example isExternalLink('https://doi.org/10.1/x', 'http://localhost:5173') // true
 */
export function isExternalLink(url: string, appOrigin: string | null): boolean {
  try {
    const parsed = new URL(url);
    if (!WEB_PROTOCOLS.has(parsed.protocol)) return false;
    return appOrigin === null || parsed.origin !== appOrigin;
  } catch {
    return false;
  }
}

/**
 * Makes every link that would take the app window to another site (a plain `<a href>` in the diary, a markdown link)
 * open in the system browser instead, and keeps the window on the app. `appOrigin` is the dev server's origin, or
 * null when the app runs from a file (then any web address is outside it).
 *
 * @example attachExternalLinkGuard(window.webContents, shell.openExternal, 'http://localhost:5173');
 */
export function attachExternalLinkGuard(
  contents: LinkGuardContents,
  openInBrowser: (url: string) => void,
  appOrigin: string | null,
): void {
  contents.on('will-navigate', (event, url) => {
    if (isExternalLink(url, appOrigin)) {
      event.preventDefault();
      openInBrowser(url);
      return;
    }
    // Leaving the app page for anything else (a dropped file, a stray scheme) is never wanted either.
    if (!isSamePage(url, appOrigin)) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalLink(url, appOrigin)) openInBrowser(url);
    return { action: 'deny' };
  });
}

function isSamePage(url: string, appOrigin: string | null): boolean {
  if (appOrigin === null) return url.startsWith('file:');
  return url.startsWith(appOrigin);
}
