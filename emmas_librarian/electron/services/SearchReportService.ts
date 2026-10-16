import * as xlsx from 'xlsx';
import type { SearchBaseOutcome, SearchHistoryItem, SearchReportFormat } from '../types';
import { isSearchBase } from '../../src/utils/searchLimits';
import { SEARCH_DATABASES } from '../../src/pages/Search/searchQueries';

/** One base in one search run, as the search strategy report lists it. */
export interface SearchReportRow {
  run: number;
  executedAt: string;
  base: string;
  query: string;
  sortBy: string;
  requested: number | null;
  returned: number;
  available: number | null;
  limitReached: boolean;
  note: string;
}

export type { SearchReportFormat };

export const LIMIT_NOTICE =
  'Uma base marcada com "limite atingido" pode ter mais resultados: a busca traz os N primeiros resultados de cada base.';
export const SCOPE_NOTICE =
  'Só entram buscas em bases de dados. Importações de outros projetos, PDFs em lote e artigos adicionados à mão não têm query e ficam de fora.';
export const EMPTY_NOTICE = 'Nenhuma busca em base de dados registrada neste projeto.';

const SORT_LABELS: Record<string, string> = { relevance: 'Relevância', citations: 'Citações', date: 'Data' };
const HEADERS = [
  'Execução',
  'Data (UTC)',
  'Base',
  'Query enviada',
  'Ordenação',
  'Limite pedido',
  'Resultados recebidos',
  'Disponíveis na base',
  'Limite atingido',
  'Observação',
];
const COLUMN_WIDTHS = [9, 18, 16, 80, 12, 13, 19, 19, 15, 40];

function parseObject<T>(raw: string | null | undefined): Record<string, T> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

// created_at is an ISO string (new rows) or SQLite's "YYYY-MM-DD HH:MM:SS" in UTC (rows from the column default).
function formatRunDate(raw: string): string {
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? raw : new Date(time).toISOString().slice(0, 16).replace('T', ' ');
}

const baseLabel = (base: string): string => SEARCH_DATABASES.find((d) => d.id === base)?.label ?? base;

function outcomeNote(outcome: SearchBaseOutcome): string {
  if (outcome.error) return `Erro: ${outcome.error}`;
  return outcome.warning ?? '';
}

function reportRow(item: SearchHistoryItem, run: number, base: string, query: string, outcome: SearchBaseOutcome) {
  // Searches made before pagination recorded no per-base limit; the common one was what every base got.
  const requested = outcome.requested ?? item.limit_val ?? null;
  return {
    run,
    executedAt: formatRunDate(item.created_at),
    base: baseLabel(base),
    query,
    sortBy: SORT_LABELS[item.sort_by ?? ''] ?? item.sort_by ?? '',
    requested,
    returned: outcome.count,
    available: outcome.available ?? null,
    limitReached: requested !== null && !outcome.error && outcome.count >= requested,
    note: outcomeNote(outcome),
  };
}

function rowsOfRun(item: SearchHistoryItem, run: number): SearchReportRow[] {
  const queries = parseObject<string>(item.translated_queries);
  const breakdown = parseObject<SearchBaseOutcome>(item.results_breakdown);
  return Object.entries(breakdown)
    .filter(([base]) => isSearchBase(base) && typeof queries[base] === 'string')
    .map(([base, outcome]) => reportRow(item, run, base, queries[base], outcome));
}

const isDatabaseSearch = (item: SearchHistoryItem): boolean => rowsOfRun(item, 0).length > 0;

/**
 * The search strategy of a project, as a systematic review reports it: one row per base and per search run, oldest
 * first, with the query exactly as it was sent to that base, the limit asked, what came back and whether the limit
 * was reached (#45).
 *
 * Usage:
 *   const rows = searchReportRows(db.getSearchHistory(projectId) as SearchHistoryItem[]);
 *   fs.writeFileSync('estrategia.md', searchReportMarkdown(rows, 'Tese', new Date()));
 */
export function searchReportRows(history: SearchHistoryItem[]): SearchReportRow[] {
  const runs = history.filter(isDatabaseSearch).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  return runs.flatMap((item, index) => rowsOfRun(item, index + 1));
}

const yesNo = (value: boolean): string => (value ? 'sim' : 'não');
const orDash = (value: number | null): string | number => (value === null ? '—' : value);

function rowCells(row: SearchReportRow): (string | number)[] {
  const { run, executedAt, base, query, sortBy, requested, returned, available, limitReached, note } = row;
  return [
    run,
    executedAt,
    base,
    query,
    sortBy,
    orDash(requested),
    returned,
    orDash(available),
    yesNo(limitReached),
    note,
  ];
}

/**
 * XLSX with the table on "Estratégia de busca" (header row first, readable column widths) and the notices on
 * "Notas". Bold headers need cell styles, which the bundled SheetJS community build does not write.
 *
 * Usage:
 *   fs.writeFileSync('estrategia.xlsx', searchReportXlsx(rows));
 */
export function searchReportXlsx(rows: SearchReportRow[]): Buffer {
  const table = xlsx.utils.aoa_to_sheet([HEADERS, ...rows.map(rowCells)]);
  table['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  const notes = xlsx.utils.aoa_to_sheet(reportNotices(rows).map((notice) => [notice]));
  notes['!cols'] = [{ wch: 120 }];
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, table, 'Estratégia de busca');
  xlsx.utils.book_append_sheet(workbook, notes, 'Notas');
  return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

function reportNotices(rows: SearchReportRow[]): string[] {
  return rows.length === 0 ? [EMPTY_NOTICE, SCOPE_NOTICE] : [LIMIT_NOTICE, SCOPE_NOTICE];
}

// Markdown tables cannot hold a pipe or a line break unescaped; queries go in fenced blocks below, verbatim.
const tableCell = (value: string | number): string => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function markdownTable(rows: SearchReportRow[]): string[] {
  const headers = HEADERS.filter((h) => h !== 'Query enviada');
  const lines = [`| ${headers.join(' | ')} |`, `|${headers.map(() => ' --- ').join('|')}|`];
  return [
    ...lines,
    ...rows.map(
      (row) =>
        `| ${rowCells(row)
          .filter((_, i) => i !== 3)
          .map(tableCell)
          .join(' | ')} |`,
    ),
  ];
}

function markdownQueries(rows: SearchReportRow[]): string[] {
  return rows.flatMap((row) => [`**Execução ${row.run}, ${row.base}**`, '', '~~~text', row.query, '~~~', '']);
}

/**
 * The same report as Markdown: notices first, then the table, then each query verbatim in a fenced block (a table
 * cell would have to escape it).
 *
 * Usage:
 *   searchReportMarkdown(rows, 'Tese', new Date()).split('\n')[0]; // "# Estratégia de busca: Tese"
 */
export function searchReportMarkdown(rows: SearchReportRow[], projectName: string, generatedAt: Date): string {
  const header = [
    `# Estratégia de busca: ${projectName}`,
    '',
    `Gerado em ${formatRunDate(generatedAt.toISOString())} (UTC).`,
    '',
  ];
  const notices = reportNotices(rows)
    .flatMap((notice) => [`> ${notice}`, '>'])
    .slice(0, -1);
  const queries = rows.length === 0 ? [] : ['## Queries', '', ...markdownQueries(rows)];
  return [...header, ...notices, '', ...markdownTable(rows), '', ...queries].join('\n');
}
