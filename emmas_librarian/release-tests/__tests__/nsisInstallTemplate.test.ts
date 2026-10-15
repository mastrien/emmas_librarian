// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

/** electron-builder's NSIS template as installed in node_modules, not a repository copy. */
function readInstalledNsisTemplate(fileName: string): string {
  const requireFromHere = createRequire(__filename);
  const packageJson = requireFromHere.resolve('app-builder-lib/package.json');
  const template = path.join(path.dirname(packageJson), 'templates', 'nsis', fileName);
  if (!fs.existsSync(template)) {
    throw new Error(`NSIS template not found at "${template}". Expected app-builder-lib/templates/nsis/${fileName}.`);
  }
  return fs.readFileSync(template, 'utf-8');
}

/**
 * Regression for the first-install crash of the installer (0xC0000005, ~20% of first installs on fresh Windows runners):
 * multiUser.nsh read NSIS_MAX_STRLEN characters (16 KB) from the short string SHGetKnownFolderPath returns, past the end
 * of its heap block. electron-builder fixed it upstream (copy with lstrcpynW, which stops at the terminator; 26.12.0). Until then
 * a patches/app-builder-lib+26.8.1.patch worked around it, dropped when the builder was upgraded; see
 * investigations/2026-10-installer-crash-root/README.md on the investigate/installer-crash-root branch.
 */
describe('electron-builder NSIS template multiUser.nsh', () => {
  const template = readInstalledNsisTemplate('multiUser.nsh');

  it('does not read a fixed NSIS_MAX_STRLEN characters from the known-folder pointer', () => {
    expect(template).not.toMatch(/System::Call\s+'\*\$\d\(&w\$\{NSIS_MAX_STRLEN\}/);
  });

  it('copies the known-folder path with a copy that stops at its terminator', () => {
    expect(template).toMatch(/lstrcpyn?W\(.*p r2/i);
  });

  it('still frees the string SHGetKnownFolderPath allocated', () => {
    expect(template).toContain("System::Call 'OLE32::CoTaskMemFree(p r2)'");
  });
});
