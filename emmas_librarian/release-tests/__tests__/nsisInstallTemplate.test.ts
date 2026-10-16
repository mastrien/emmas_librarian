// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readInstalledBuilderFile } from '../installedBuilder';

/**
 * Regression for the first-install crash of the installer (0xC0000005, ~20% of first installs on fresh Windows runners):
 * multiUser.nsh read NSIS_MAX_STRLEN characters (16 KB) from the short string SHGetKnownFolderPath returns, past the end
 * of its heap block. electron-builder fixed it upstream (copy with lstrcpynW, which stops at the terminator; 26.12.0). Until then
 * a patches/app-builder-lib+26.8.1.patch worked around it, dropped when the builder was upgraded; see
 * investigations/2026-10-installer-crash-root/README.md on the investigate/installer-crash-root branch.
 *
 * The patterns match code lines only (`^\s*System::Call`), so a comment or a commented-out call cannot satisfy them.
 */
describe('electron-builder NSIS template multiUser.nsh', () => {
  const template = readInstalledBuilderFile(['templates/nsis/multiUser.nsh']);

  it('does not read a fixed NSIS_MAX_STRLEN characters from the known-folder pointer', () => {
    // `*$2(` (the 26.8.1 form) and `*r2(` (register form) both read from the pointer.
    expect(template).not.toMatch(/^\s*System::Call\s+'\*(\$\d|r\d)\(&w\$\{NSIS_MAX_STRLEN\}/m);
  });

  it('copies the known-folder path with a copy that stops at its terminator', () => {
    expect(template).toMatch(/^\s*System::Call\s+'[^']*lstrcpyn?W\([^)]*p r2/im);
  });

  it('still frees the string SHGetKnownFolderPath allocated', () => {
    expect(template).toMatch(/^\s*System::Call\s+'OLE32::CoTaskMemFree\(p r2\)'/m);
  });
});
