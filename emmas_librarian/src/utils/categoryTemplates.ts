import type { ProjectCategory } from '../types';

/** Category kinds the project categories accept (see ProjectCategoriesModal). */
export const CATEGORY_KINDS = ['text', 'boolean', 'enum', 'multiselect'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** One category of a template or of an exported set: its name, kind and, for lists, the options in order. */
export interface CategorySetEntry {
  name: string;
  type: CategoryKind;
  options?: string[];
}

export interface CategoryTemplate {
  id: string;
  label: string;
  description: string;
  categories: CategorySetEntry[];
}

/** What applying a set did: categories created, and those skipped because the project already had the name. */
export interface CategorySetResult {
  created: string[];
  skipped: string[];
}

const SET_KIND = 'emma-category-set';
const SET_FORMAT_VERSION = 1;

const text = (name: string): CategorySetEntry => ({ name, type: 'text' });
const choice = (name: string, options: string[]): CategorySetEntry => ({ name, type: 'enum', options });

// Generic structure only (#46): no wording copied from published risk-of-bias instruments until their licences are
// checked. Every category stays editable after it is created.
export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    id: 'pico',
    label: 'PICO',
    description: 'População, Intervenção, Comparação e Desfecho, em campos de texto.',
    categories: [text('População'), text('Intervenção'), text('Comparação'), text('Desfecho')],
  },
  {
    id: 'study-characteristics',
    label: 'Características do estudo',
    description: 'Desenho, local, amostra, período e financiamento.',
    categories: [
      choice('Desenho do estudo', [
        'Ensaio clínico randomizado',
        'Ensaio não randomizado',
        'Coorte',
        'Caso-controle',
        'Transversal',
        'Série ou relato de casos',
        'Qualitativo',
        'Métodos mistos',
        'Revisão',
        'Outro',
      ]),
      text('País ou região'),
      text('Tamanho da amostra'),
      text('Período de coleta'),
      text('Financiamento'),
    ],
  },
  {
    id: 'methodological-quality',
    label: 'Qualidade metodológica (genérica)',
    description: 'Avaliação geral e por domínio, com campo para justificar. Não substitui um instrumento validado.',
    categories: [
      choice('Seleção dos participantes', ['Adequada', 'Com limitações', 'Inadequada', 'Não informado']),
      choice('Medida do desfecho', ['Adequada', 'Com limitações', 'Inadequada', 'Não informado']),
      choice('Dados ausentes', ['Adequado', 'Com limitações', 'Inadequado', 'Não informado']),
      choice('Avaliação geral', ['Alta', 'Moderada', 'Baixa', 'Não avaliada']),
      text('Justificativa da avaliação'),
    ],
  },
];

const hasOptions = (type: CategoryKind): boolean => type === 'enum' || type === 'multiselect';

function categoryOptionNames(category: ProjectCategory): string[] {
  if (category.parsedOptions) return category.parsedOptions.map((o) => o.name);
  return (category.options ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toEntry(category: ProjectCategory): CategorySetEntry {
  const type = (CATEGORY_KINDS as readonly string[]).includes(category.type) ? (category.type as CategoryKind) : 'text';
  return hasOptions(type)
    ? { name: category.name, type, options: categoryOptionNames(category) }
    : { name: category.name, type };
}

/**
 * The project's categories as a JSON file another project can import (the user's own template).
 *
 * Usage:
 *   api.saveFile(categorySetJson(categories), 'categorias.json');
 */
export function categorySetJson(categories: ProjectCategory[]): string {
  const set = { kind: SET_KIND, formatVersion: SET_FORMAT_VERSION, categories: categories.map(toEntry) };
  return JSON.stringify(set, null, 2);
}

const EXPECTED_SHAPE =
  'Expected shape: {"kind":"emma-category-set","formatVersion":1,"categories":[{"name":"...","type":"text|boolean|enum|multiselect","options":["..."]}]}';

function invalidSet(what: string, value: unknown): Error {
  const shown = JSON.stringify(value)?.slice(0, 200) ?? String(value);
  return new Error(`[ERR_INVALID_CATEGORY_SET] ${what}. Offending value: ${shown}. ${EXPECTED_SHAPE}`);
}

function parseEntry(value: unknown): CategorySetEntry {
  const entry = value as Partial<CategorySetEntry> | null;
  if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) throw invalidSet('Categoria sem nome', value);
  if (!CATEGORY_KINDS.includes(entry.type as CategoryKind)) throw invalidSet('Tipo de categoria desconhecido', value);
  const type = entry.type as CategoryKind;
  if (!hasOptions(type)) return { name: entry.name.trim(), type };
  const options = entry.options;
  if (!Array.isArray(options) || options.some((o) => typeof o !== 'string')) {
    throw invalidSet('Lista de opções inválida', value);
  }
  return { name: entry.name.trim(), type, options: options.map((o) => o.trim()).filter(Boolean) };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw invalidSet('O arquivo não é um JSON válido', raw);
  }
}

/**
 * Reads a category set exported by categorySetJson, refusing anything else with the value received and the shape
 * expected.
 *
 * Usage:
 *   const entries = parseCategorySet(fs.readFileSync(file, 'utf-8'));
 */
export function parseCategorySet(raw: string): CategorySetEntry[] {
  const set = parseJson(raw) as { kind?: unknown; formatVersion?: unknown; categories?: unknown } | null;
  if (!set || set.kind !== SET_KIND) throw invalidSet('Não é um conjunto de categorias do Emma', set?.kind ?? set);
  if (set.formatVersion !== SET_FORMAT_VERSION) throw invalidSet('Versão de formato não suportada', set.formatVersion);
  return validateCategorySetEntries(set.categories);
}

/**
 * Checks a list of categories received from elsewhere (the renderer, a file) before it reaches the database.
 *
 * Usage:
 *   db.applyCategorySet(projectId, validateCategorySetEntries(entriesFromIpc));
 */
export function validateCategorySetEntries(value: unknown): CategorySetEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw invalidSet('Conjunto sem categorias', value);
  return value.map(parseEntry);
}

/**
 * What to tell the person after a set was applied: how many categories were created and which names were skipped.
 *
 * Usage:
 *   describeCategorySetResult({ created: ['A'], skipped: ['B'] }); // "1 categoria criada. Já existiam e foram mantidas: B."
 */
export function describeCategorySetResult({ created, skipped }: CategorySetResult): string {
  const createdText = created.length === 1 ? '1 categoria criada.' : `${created.length} categorias criadas.`;
  if (skipped.length === 0) return createdText;
  return `${createdText} Já existiam e foram mantidas: ${skipped.join(', ')}.`;
}
