import { describe, it, expect } from 'vitest';
import { attachExternalLinkGuard, isExternalLink, type LinkGuardContents } from '../externalLinks';

const DEV = 'http://localhost:5173';

class FakeWebContents implements LinkGuardContents {
  navigate?: (event: { preventDefault(): void }, url: string) => void;
  openHandler?: (details: { url: string }) => { action: 'deny' };
  on(_event: 'will-navigate', listener: (event: { preventDefault(): void }, url: string) => void): void {
    this.navigate = listener;
  }
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void {
    this.openHandler = handler;
  }
  /** Simulates a click on a link: returns whether the navigation was cancelled. */
  click(url: string): boolean {
    let cancelled = false;
    this.navigate?.({ preventDefault: () => (cancelled = true) }, url);
    return cancelled;
  }
}

describe('isExternalLink', () => {
  it('accepts web and mail addresses outside the app', () => {
    expect(isExternalLink('https://doi.org/10.1/x', DEV)).toBe(true);
    expect(isExternalLink('mailto:a@b.c', null)).toBe(true);
  });

  it('refuses the app page, files, custom schemes and junk', () => {
    expect(isExternalLink('http://localhost:5173/#/x', DEV)).toBe(false);
    expect(isExternalLink('file:///C:/secret.txt', null)).toBe(false);
    expect(isExternalLink('vscode://open', DEV)).toBe(false);
    expect(isExternalLink('not a url', DEV)).toBe(false);
  });
});

describe('attachExternalLinkGuard', () => {
  it('opens a clicked web link in the browser and keeps the window on the app (diary links)', () => {
    const contents = new FakeWebContents();
    const opened: string[] = [];
    attachExternalLinkGuard(contents, (url) => opened.push(url), DEV);

    expect(contents.click('https://example.org/page')).toBe(true);

    expect(opened).toEqual(['https://example.org/page']);
  });

  it('lets the app navigate inside itself', () => {
    const contents = new FakeWebContents();
    const opened: string[] = [];
    attachExternalLinkGuard(contents, (url) => opened.push(url), DEV);

    expect(contents.click('http://localhost:5173/#/projects/1')).toBe(false);
    expect(opened).toEqual([]);
  });

  it('blocks a navigation to a file or a stray scheme without opening it', () => {
    const contents = new FakeWebContents();
    const opened: string[] = [];
    attachExternalLinkGuard(contents, (url) => opened.push(url), null);

    expect(contents.click('ms-settings:network')).toBe(true);
    expect(opened).toEqual([]);
  });

  it('opens window.open of a web address in the browser and never opens a file', () => {
    const contents = new FakeWebContents();
    const opened: string[] = [];
    attachExternalLinkGuard(contents, (url) => opened.push(url), DEV);

    expect(contents.openHandler?.({ url: 'https://example.org' })).toEqual({ action: 'deny' });
    contents.openHandler?.({ url: 'file:///C:/x.exe' });

    expect(opened).toEqual(['https://example.org']);
  });
});
