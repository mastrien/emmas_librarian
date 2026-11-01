import type { Article, PrismaExportTables } from '../../types';
import { baseName } from '../prismaSearches';
import { Decisions } from './prismaDecisions';
import { METHOD_NAMES } from './prismaOtherColumn';
import type { PrismaBox, PrismaBoxKey, PrismaColumn, PrismaFlow, PrismaInput } from './prismaTypes';

const COLUMN_NAMES: Record<PrismaColumn, string> = {
  databases: 'Bases de dados e repositórios',
  other: 'Outros métodos',
  both: 'As duas colunas',
};

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const csv = (rows: (string | number)[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\n');

function boxRows(b: PrismaBox): (string | number)[][] {
  const column = COLUMN_NAMES[b.column];
  const lineRow = (label: string, n: number | null, note = '') => [column, b.title, label, n ?? 'sem dados', note, ''];
  return [
    [column, b.title, '', b.n, b.how, b.warnings.map((w) => w.text).join(' | ')],
    ...b.lines.map((l) => lineRow(l.label, l.n, l.note)),
    ...b.details.map((l) => lineRow(l.label, l.n, l.note)),
  ];
}

/**
 * The data table that goes with an exported diagram: one row per box and per line inside it, with the column,
 * how it is counted and its warnings. "sem dados" where a number is unknown.
 *
 * @example prismaDataCsv(flow, order).split('\n')[0] // '"Coluna","Caixa","Linha","n","De onde vem","Aviso"'
 */
export function prismaDataCsv(flow: PrismaFlow, order: PrismaBoxKey[]): string {
  const header = ['Coluna', 'Caixa', 'Linha', 'n', 'De onde vem', 'Aviso'];
  return csv([header, ...order.flatMap((key) => boxRows(flow[key]))]);
}

/**
 * A reference as one line: authors, title, journal, year and DOI, leaving out what the article lacks.
 *
 * @example referenceOf({ authors: 'Shi X', title: 'ConvLSTM', year: 2015 } as Article) // 'Shi X. ConvLSTM. 2015.'
 */
export function referenceOf(a: Article): string {
  const parts = [a.authors, a.title, [a.journal, a.year].filter(Boolean).join(', '), a.doi ? `DOI: ${a.doi}` : ''];
  return parts
    .filter((p) => p && String(p).trim())
    .map((p) => `${String(p).trim().replace(/\.$/, '')}.`)
    .join(' ');
}

interface ExcludedRow {
  stage: string;
  reason: string;
}

// Why an article sits in an exclusion box: its full-text label, else its title label, else archived unlabeled.
function reasonOf(a: Article, d: Decisions): ExcludedRow {
  const full = d.labelAt(a.id, 'full');
  if (full) return { stage: 'Texto completo', reason: full.name };
  const title = d.labelAt(a.id, 'title');
  if (title) return { stage: 'Título e resumo', reason: title.name };
  return { stage: 'Título e resumo', reason: 'Arquivado sem rótulo' };
}

function originOf(input: PrismaInput, flow: PrismaFlow): (a: Article) => string {
  const sources = new Map(input.records.sources.map((s) => [s.id, `${s.name} (${METHOD_NAMES[s.method]})`]));
  const origins = new Map(input.records.origins.map((o) => [o.article_id, sources.get(o.source_id)]));
  const searches = new Map(flow.searches.map((s) => [s.searchId, s.bases.map((b) => baseName(b.base)).join(', ')]));
  const outside = new Set(flow.omIdentified.articleIds);
  return (a) => {
    if (outside.has(a.id)) return `Outros métodos · ${origins.get(a.id) ?? 'origem não informada'}`;
    return `Busca #${a.search_id} · ${searches.get(a.search_id ?? -1) ?? ''}`.replace(/ · $/, '');
  };
}

/** One report of the item 16b list. */
export interface ExcludedReport {
  articleId: number;
  reference: string;
  stage: string;
  reason: string;
  origin: string;
}

const EXCLUDED_BOXES: PrismaBoxKey[] = ['reasons', 'notRetrieved', 'omReasons', 'omNotRetrieved'];

/**
 * The list PRISMA 2020 item 16b asks for: every report excluded at full text, or whose full text was not
 * retrieved, with its reference, stage, reason and origin. Shown under the diagram and exported beside it.
 *
 * @example excludedReports(input, flow)[0].reason // 'População diferente'
 */
export function excludedReports(input: PrismaInput, flow: PrismaFlow): ExcludedReport[] {
  const d = new Decisions(input);
  const origin = originOf(input, flow);
  return EXCLUDED_BOXES.flatMap((k) => flow[k].articleIds)
    .map((id) => input.articles.find((a) => a.id === id))
    .filter((a): a is Article => a !== undefined)
    .map((a) => ({ articleId: a.id, reference: referenceOf(a), ...reasonOf(a, d), origin: origin(a) }));
}

/**
 * The item 16b list as the CSV saved beside the diagram.
 *
 * @example prismaExcludedCsv(input, flow).split('\n')[0] // '"Referência","Etapa","Motivo","Origem"'
 */
export function prismaExcludedCsv(input: PrismaInput, flow: PrismaFlow): string {
  const rows = excludedReports(input, flow).map((r) => [r.reference, r.stage, r.reason, r.origin]);
  return csv([['Referência', 'Etapa', 'Motivo', 'Origem'], ...rows]);
}

/** Both tables of the export. */
export function prismaTables(input: PrismaInput, flow: PrismaFlow, order: PrismaBoxKey[]): PrismaExportTables {
  return { data: prismaDataCsv(flow, order), excluded: prismaExcludedCsv(input, flow) };
}
