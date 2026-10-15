import path from 'path';
import { describe, expect, it } from 'vitest';
import { unpackedExecutable } from '../packagedApp';

describe('unpackedExecutable', () => {
  it('points at the Windows build under release/win-unpacked', () => {
    expect(unpackedExecutable('win32', 'C:/work/release')).toBe(
      path.join('C:/work/release', 'win-unpacked', "Emma's Librarian.exe"),
    );
  });

  it('points at the Linux build under release/linux-unpacked', () => {
    expect(unpackedExecutable('linux', '/work/release')).toBe(
      path.join('/work/release', 'linux-unpacked', 'emmas-librarian'),
    );
  });

  it('refuses a platform with no packaged build, naming it', () => {
    expect(() => unpackedExecutable('darwin', '/work/release')).toThrow(/ERR_RELEASE_TEST_PLATFORM.*"darwin"/);
  });
});
