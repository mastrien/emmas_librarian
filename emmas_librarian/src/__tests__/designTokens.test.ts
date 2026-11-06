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
