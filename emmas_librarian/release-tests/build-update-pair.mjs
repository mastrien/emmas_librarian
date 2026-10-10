// Builds two installers (Windows) or AppImages (Linux) of this checkout, `from` and `to`, whose updater looks for releases on a local
// "generic" server (release-tests/updateServer.ts) instead of GitHub, for release-tests/updateFlow.release.ts.
// Run after `vite build` and `tsc -p tsconfig.electron.json`.
// Usage: node release-tests/build-update-pair.mjs <port> <fromVersion> <toVersion>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [port, ...versions] = process.argv.slice(2);
if (!port || versions.length !== 2) {
  throw new Error(
    `Usage: build-update-pair.mjs <port> <from> <to>. Got port="${port}" versions=${JSON.stringify(versions)}.`,
  );
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
// What this platform's updater installs: the NSIS setup on Windows, the AppImage on Linux (issue #17).
const TARGETS = { win32: ['--win', 'nsis'], linux: ['--linux', 'AppImage'] };
const TARGET = TARGETS[process.platform];
if (!TARGET) {
  throw new Error(
    `build-update-pair.mjs: no update target for platform "${process.platform}". Expected win32 or linux.`,
  );
}
fs.mkdirSync('release-update', { recursive: true });

for (const version of versions) {
  const output = path.join('release-update', version);
  const config = {
    ...pkg.build,
    // Baked into resources/app-update.yml: where this build's updater asks for latest.yml.
    publish: [{ provider: 'generic', url: `http://127.0.0.1:${port}/` }],
    extraMetadata: { version },
    directories: { ...pkg.build.directories, output },
  };
  const configFile = path.join('release-update', `config-${version}.json`);
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  execFileSync('npx', ['electron-builder', '--config', configFile, ...TARGET, '--publish', 'never'], {
    stdio: 'inherit',
    shell: true,
  });
}
