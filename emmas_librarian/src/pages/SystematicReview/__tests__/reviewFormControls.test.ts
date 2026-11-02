import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Validation of epic #44 (2026-11-01): the labels modal, the guided screening note and the PRISMA panel selects
// were bare browser controls. Every typed field of the review page wears the app's `input-field` style.
const REVIEW_DIR = path.resolve(__dirname, '..');
const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
const UNSTYLED_TYPES = new Set(['checkbox', 'radio', 'file', 'hidden']);

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function reviewSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : reviewSources(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

function literalAttribute(tag: JsxTag, name: string): string | undefined {
  const attr = tag.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  );
  const init = attr?.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init.text;
  return init.getText();
}

function fieldTags(node: ts.Node, found: JsxTag[] = []): JsxTag[] {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && FIELD_TAGS.has(node.tagName.getText())) {
    found.push(node);
  }
  node.forEachChild((child) => void fieldTags(child, found));
  return found;
}

/** The fields of one file that do not carry `input-field`, as "file:line <tag>". */
function unstyledFields(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return fieldTags(source)
    .filter((tag) => !UNSTYLED_TYPES.has(literalAttribute(tag, 'type') ?? 'text'))
    .filter((tag) => !(literalAttribute(tag, 'className') ?? '').includes('input-field'))
    .map((tag) => {
      const line = source.getLineAndCharacterOfPosition(tag.getStart()).line + 1;
      return `${path.relative(REVIEW_DIR, file)}:${line} <${tag.tagName.getText()}>`;
    });
}

describe('review page form controls', () => {
  it('finds the review sources it checks', () => {
    expect(reviewSources(REVIEW_DIR).length).toBeGreaterThan(5);
  });

  it('styles every text field, select and textarea with input-field', () => {
    expect(reviewSources(REVIEW_DIR).flatMap(unstyledFields)).toEqual([]);
  });
});
