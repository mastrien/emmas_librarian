import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Reads a file of the electron-builder package as installed in node_modules (not a repository copy), so a test fails
 * when a lockfile change brings back a template with a known defect.
 *
 * `relativePaths` lists the places the file may be, relative to app-builder-lib: the AppImage folder is `appImage` in
 * old versions and `appimage` in new ones. Usage: `readInstalledBuilderFile(['templates/nsis/multiUser.nsh'])`.
 */
export function readInstalledBuilderFile(relativePaths: string[]): string {
  const requireFromHere = createRequire(__filename);
  const packageRoot = path.dirname(requireFromHere.resolve('app-builder-lib/package.json'));
  const found = relativePaths.map((relative) => path.join(packageRoot, relative)).find((file) => fs.existsSync(file));
  if (!found) {
    throw new Error(
      `[ERR_BUILDER_FILE_MISSING] None of ${JSON.stringify(relativePaths)} exists under "${packageRoot}". ` +
        'Expected a file of app-builder-lib; did the package layout change?',
    );
  }
  return fs.readFileSync(found, 'utf-8');
}
