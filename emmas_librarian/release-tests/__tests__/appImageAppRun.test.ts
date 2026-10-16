// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readInstalledBuilderFile } from '../installedBuilder';

/**
 * Regression for #37 (the Ubuntu AppImage that sometimes aborts at startup in PartitionAlloc). The AppRun that
 * electron-builder writes into the AppImage built `XDG_DATA_DIRS="...:${XDG_DATA_DIRS}:..."`, which leaves an empty entry
 * (`::`) when the variable is unset or empty; with it the app crashed in ~1.5% of launches (6/400 across `unset` and
 * `empty`, run 38765793167; 0/400 with the fixed AppRun, run 38818637657). Fixed upstream in 26.10.0, which only adds
 * the separator when the variable has a value (`${XDG_DATA_DIRS:+:${XDG_DATA_DIRS}}`).
 *
 * This reads the AppRun source of the installed builder, so a lockfile change (regeneration, downgrade, revert) that
 * brings back the old script fails here, not on a user's machine.
 */
const APP_IMAGE_UTIL_PATHS = ['out/targets/appimage/appImageUtil.js', 'out/targets/appImage/appImageUtil.js'];

function xdgDataDirsExports(): string[] {
  const source = readInstalledBuilderFile(APP_IMAGE_UTIL_PATHS);
  return source.split('\n').filter((line) => /^\s*export XDG_DATA_DIRS=/.test(line));
}

describe('electron-builder AppRun script (#37)', () => {
  it('sets XDG_DATA_DIRS somewhere, so the check below is not vacuous', () => {
    expect(xdgDataDirsExports().length).toBeGreaterThan(0);
  });

  it('adds the separator after ${XDG_DATA_DIRS} only when the variable has a value', () => {
    const unguarded = xdgDataDirsExports().filter((line) => !line.includes('XDG_DATA_DIRS:+:'));
    expect(unguarded).toEqual([]);
  });
});
