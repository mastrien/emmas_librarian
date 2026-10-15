import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { windowIconFile } from '../windowIcon';

const projectRoot = path.join(__dirname, '..', '..');

describe('windowIconFile', () => {
  it('gives Windows the .ico', () => {
    expect(windowIconFile('/app', 'win32', false)).toBe(path.join('/app', 'dist', 'favicon.ico'));
  });

  it('gives Linux a PNG, which nativeImage can read there', () => {
    expect(windowIconFile('/app', 'linux', false)).toBe(path.join('/app', 'dist', 'app-icon.png'));
  });

  it('reads from public/ in development', () => {
    expect(windowIconFile('/app', 'linux', true)).toBe(path.join('/app', 'public', 'app-icon.png'));
  });

  it('points at files that exist in public/, which Vite copies to dist/', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(fs.existsSync(windowIconFile(projectRoot, platform, true))).toBe(true);
    }
  });
});
