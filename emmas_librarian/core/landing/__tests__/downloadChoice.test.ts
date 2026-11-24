// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}
interface DownloadChoice {
  system: string;
  asset: ReleaseAsset | null;
  label: string;
  note: string;
}
interface LandingDownload {
  chooseDownload(userAgent: string, assets: ReleaseAsset[]): DownloadChoice;
  detectSystem(userAgent: string): string;
}

// The landing page is plain static files, so its script is CommonJS-compatible and loaded as the browser sees it.
const { chooseDownload, detectSystem } = createRequire(import.meta.url)(
  '../../../../landing_page/download.js',
) as LandingDownload;

const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148';

// Release v1.4.0 carries these, among others.
const ASSETS: ReleaseAsset[] = [
  { name: 'emmas-librarian-1.4.0-x86_64.AppImage', browser_download_url: 'https://example.test/app.AppImage' },
  { name: 'emmas_librarian-setup-1.4.0.exe', browser_download_url: 'https://example.test/setup.exe' },
  { name: 'emmas_librarian-setup-1.4.0.exe.blockmap', browser_download_url: 'https://example.test/setup.blockmap' },
  { name: 'latest-linux.yml', browser_download_url: 'https://example.test/latest-linux.yml' },
];

describe('detectSystem', () => {
  it.each([
    [WINDOWS, 'windows'],
    [LINUX, 'linux'],
    [MAC, 'mac'],
    [ANDROID, 'mobile'],
    [IPHONE, 'mobile'],
    ['', 'unknown'],
  ])('reads %s as %s', (userAgent, system) => {
    expect(detectSystem(userAgent)).toBe(system);
  });
});

describe('chooseDownload', () => {
  it('offers the installer on Windows, not the blockmap that also ends in .exe.blockmap', () => {
    const choice = chooseDownload(WINDOWS, ASSETS);
    expect(choice.asset?.name).toBe('emmas_librarian-setup-1.4.0.exe');
    expect(choice.label).toBe('Windows');
  });

  // The reported bug: the page only ever looked for the .exe.
  it('offers the AppImage on Linux', () => {
    const choice = chooseDownload(LINUX, ASSETS);
    expect(choice.asset?.browser_download_url).toBe('https://example.test/app.AppImage');
    expect(choice.label).toBe('Linux (AppImage)');
    expect(choice.note).toBe('');
  });

  it('says there is no Mac version and offers no file', () => {
    expect(chooseDownload(MAC, ASSETS)).toMatchObject({
      system: 'mac',
      asset: null,
      note: expect.stringContaining('Ainda não há versão para Mac'),
    });
  });

  it('does not offer the Linux file to an Android phone', () => {
    expect(chooseDownload(ANDROID, ASSETS)).toMatchObject({ system: 'mobile', asset: null });
  });

  it('keeps no file when the release has none for that system', () => {
    expect(
      chooseDownload(
        LINUX,
        ASSETS.filter((a) => !a.name.endsWith('.AppImage')),
      ).asset,
    ).toBeNull();
    expect(chooseDownload(LINUX, []).asset).toBeNull();
  });
});
