import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(css|tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({ file: path.relative(SRC, file), text: fs.readFileSync(file, 'utf8') }));

// Defined in a stylesheet (`--name:`) or set from a component (`'--name':` in a style object).
const defined = new Set(
  files.flatMap(({ text }) => [...text.matchAll(/['"]?(--[a-z][\w-]*)['"]?\s*:/g)].map((m) => m[1])),
);

// Only uses without a fallback: `var(--name, value)` already renders something when the token is missing.
function undefinedUses(): string[] {
  return files.flatMap(({ file, text }) =>
    [...text.matchAll(/var\((--[a-z][\w-]*)\s*\)/g)].filter((m) => !defined.has(m[1])).map((m) => `${file}: ${m[1]}`),
  );
}

describe('design tokens (Arca 134)', () => {
  // Fifteen tokens were used without being defined, so their rule silently did nothing: an invisible progress
  // track, no menu hover, the current AI model's border gone.
  it('defines every token the code uses without a fallback', () => {
    expect(undefinedUses()).toEqual([]);
  });
});

const ROOT = path.resolve(SRC, '..');
const styleCss = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');

function tokenFamily(token: string): string {
  const match = styleCss.match(new RegExp(`${token}:\\s*'([^']+)'`));
  if (!match) throw new Error(`style.css has no quoted family for ${token}; expected "${token}: 'Family', fallback"`);
  return match[1];
}

function bundledFamily(pkg: string): string {
  const css = fs.readFileSync(path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'index.css'), 'utf8');
  const match = css.match(/font-family:\s*'([^']+)'/);
  if (!match) throw new Error(`@fontsource-variable/${pkg}/index.css declares no font-family`);
  return match[1];
}

describe('fonts (redesign, Lexend + Source Serif 4 + JetBrains Mono)', () => {
  // Google Fonts made the interface fall back to system fonts whenever the researcher was offline.
  it('loads no font from the network', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('points each font token at a family the app bundles', () => {
    expect(tokenFamily('--font-sans')).toBe(bundledFamily('lexend'));
    expect(tokenFamily('--font-heading')).toBe(bundledFamily('lexend'));
    expect(tokenFamily('--font-read')).toBe(bundledFamily('source-serif-4'));
    expect(tokenFamily('--font-mono')).toBe(bundledFamily('jetbrains-mono'));
  });

  it('imports the three bundled families at startup', () => {
    const fonts = fs.readFileSync(path.join(SRC, 'theme', 'fonts.ts'), 'utf8');
    const main = fs.readFileSync(path.join(SRC, 'main.tsx'), 'utf8');

    for (const pkg of ['lexend', 'source-serif-4', 'jetbrains-mono']) {
      expect(fonts).toContain(`'@fontsource-variable/${pkg}'`);
    }
    expect(main).toContain("import './theme/fonts';");
  });

  it('uses the mono token instead of a bare monospace stack', () => {
    const bare = files
      .filter(({ file }) => file !== 'style.css')
      .flatMap(({ file, text }) => [...text.matchAll(/font-?[fF]amily:\s*['"]?(?:ui-)?monospace/g)].map(() => file));

    expect(bare).toEqual([]);
  });
});
