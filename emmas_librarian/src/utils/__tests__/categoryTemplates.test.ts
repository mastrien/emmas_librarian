import { describe, it, expect } from 'vitest';
import {
  CATEGORY_TEMPLATES,
  categorySetJson,
  describeCategorySetResult,
  parseCategorySet,
  validateCategorySetEntries,
} from '../categoryTemplates';
import type { ProjectCategory } from '../../types';

const projectCategories: ProjectCategory[] = [
  { id: 1, project_id: 9, name: 'Método', type: 'text' },
  {
    id: 2,
    project_id: 9,
    name: 'Desenho',
    type: 'enum',
    parsedOptions: [
      { id: 7, name: 'Coorte' },
      { id: 8, name: 'Transversal' },
    ],
  },
  { id: 3, project_id: 9, name: 'Revisado', type: 'boolean' },
  // Categories from before the relational options kept them as comma-separated text.
  { id: 4, project_id: 9, name: 'Base', type: 'multiselect', options: 'Scopus, WoS' },
];

describe('category templates (#46)', () => {
  it('ships PICO, study characteristics and generic quality, each a valid set with unique names', () => {
    expect(CATEGORY_TEMPLATES.map((t) => t.id)).toEqual(['pico', 'study-characteristics', 'methodological-quality']);
    for (const template of CATEGORY_TEMPLATES) {
      const names = template.categories.map((c) => c.name);
      expect(validateCategorySetEntries(template.categories)).toEqual(template.categories);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('round-trips a project’s categories through the JSON file, options in order', () => {
    expect(parseCategorySet(categorySetJson(projectCategories))).toEqual([
      { name: 'Método', type: 'text' },
      { name: 'Desenho', type: 'enum', options: ['Coorte', 'Transversal'] },
      { name: 'Revisado', type: 'boolean' },
      { name: 'Base', type: 'multiselect', options: ['Scopus', 'WoS'] },
    ]);
  });

  it.each([
    ['not JSON', '{ not json', /não é um JSON válido.*\{ not json/],
    ['another kind of file', JSON.stringify({ kind: 'zotero' }), /Não é um conjunto de categorias.*"zotero"/],
    ['a newer format', JSON.stringify({ kind: 'emma-category-set', formatVersion: 2, categories: [] }), /Versão.*2/],
    [
      'an unknown type',
      JSON.stringify({ kind: 'emma-category-set', formatVersion: 1, categories: [{ name: 'X', type: 'date' }] }),
      /Tipo de categoria desconhecido.*"date"/,
    ],
    [
      'a list without options',
      JSON.stringify({ kind: 'emma-category-set', formatVersion: 1, categories: [{ name: 'X', type: 'enum' }] }),
      /Lista de opções inválida/,
    ],
  ])('refuses %s, naming the value and the expected shape', (_case, raw, message) => {
    expect(() => parseCategorySet(raw)).toThrowError(message);
    expect(() => parseCategorySet(raw)).toThrowError(
      /ERR_INVALID_CATEGORY_SET.*Expected shape: \{"kind":"emma-category-set"/,
    );
  });

  it('refuses an empty set', () => {
    expect(() => validateCategorySetEntries([])).toThrowError(/Conjunto sem categorias/);
  });

  it('describes what was created and what was kept', () => {
    expect(describeCategorySetResult({ created: ['A'], skipped: [] })).toBe('1 categoria criada.');
    expect(describeCategorySetResult({ created: ['A', 'B'], skipped: ['C'] })).toBe(
      '2 categorias criadas. Já existiam e foram mantidas: C.',
    );
  });
});
