import type {
  Article,
  PrismaManualCount,
  ScreeningDecision,
  ScreeningKind,
  ScreeningLabel,
  ScreeningStage,
  SearchHistoryItem,
} from '../types';
import { baseName, searchContribution, type SearchContribution } from './prismaSearches';

export type PrismaBoxKey =
  | 'identified'
  | 'removed'
  | 'screened'
  | 'excluded'
  | 'sought'
  | 'notRetrieved'
  | 'assessed'
  | 'reasons'
  | 'included';

/** A line inside a box; `n` null means "sem dados", never an estimate. */
export interface PrismaLine {
  label: string;
  n: number | null;
  note?: string;
}

/** mismatch: outputs do not add up to the input; partial: a base hit its limit; nodata: an old search cannot be checked. */
export interface PrismaWarning {
  kind: 'mismatch' | 'partial' | 'nodata';
  text: string;
}

/** One box of the diagram: its number, its lines, what it is made of, how it is counted and its warnings. */
export interface PrismaBox {
  key: PrismaBoxKey;
  title: string;
  n: number;
  lines: PrismaLine[];
  how: string;
  warnings: PrismaWarning[];
  articleIds: number[];
}

export interface PrismaInput {
  searches: SearchHistoryItem[];
  articles: Article[];
  labels: ScreeningLabel[];
  decisions: ScreeningDecision[];
  manual: PrismaManualCount[];
}

export type PrismaFlow = Record<PrismaBoxKey, PrismaBox> & { searches: SearchContribution[] };

/** Preset key of the label PRISMA 2020 reports as its own box, "reports not retrieved". */
export const NOT_RETRIEVED_KEY = 'prisma2020.not-retrieved';

// The decisions and labels of the project, read the same way by every box.
class Decisions {
  constructor(private readonly input: PrismaInput) {}

  labelAt(articleId: number, stage: ScreeningStage): ScreeningLabel | null {
    const decision = this.input.decisions.find((d) => d.article_id === articleId && d.stage === stage);
    return this.input.labels.find((l) => l.id === decision?.label_id) ?? null;
  }

  kindAt(articleId: number, stage: ScreeningStage): ScreeningKind | null {
    return this.labelAt(articleId, stage)?.kind ?? null;
  }

  withKind(articles: Article[], stage: ScreeningStage, kind: ScreeningKind): Article[] {
    return articles.filter((a) => this.kindAt(a.id, stage) === kind);
  }
}

const ids = (articles: Article[]) => articles.map((a) => a.id);

/**
 * A stored SQLite date as Brazilians write it.
 *
 * @example brazilianDate('2026-10-30 08:00:00') // '30/10/2026'
 */
export function brazilianDate(stored: string): string {
  const [year, month, day] = stored.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : stored;
}
const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);

function groupByLabel(articles: Article[], decisions: Decisions, stage: ScreeningStage): PrismaLine[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    const name = decisions.labelAt(article.id, stage)?.name ?? '';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, n]) => ({ label, n }));
}

function box(key: PrismaBoxKey, title: string, how: string, articles: Article[], lines: PrismaLine[] = []): PrismaBox {
  return { key, title, n: articles.length, lines, how, warnings: [], articleIds: ids(articles) };
}

function identifiedBox(input: PrismaInput, searches: SearchContribution[]): PrismaBox {
  const perBase = new Map<string, number>();
  searches.flatMap((s) => s.bases).forEach((b) => perBase.set(b.base, (perBase.get(b.base) ?? 0) + b.count));
  const outside = input.articles.filter((a) => !a.search_id);
  const manual = input.manual.find((m) => m.count_key === 'other_sources');
  const other = manual ? manual.value : outside.length;
  const lines: PrismaLine[] = [
    ...[...perBase.entries()].map(([base, n]) => ({ label: baseName(base), n })),
    {
      label: 'Outras fontes',
      n: other,
      note: manual ? `editado manualmente em ${brazilianDate(manual.updated_at)}` : 'contado pelo app',
    },
  ];
  const result: PrismaBox = {
    ...box('identified', 'Registros identificados', IDENTIFIED_HOW, outside),
    n: sum([...perBase.values()]) + other,
    lines,
  };
  result.warnings = searches.flatMap((s) =>
    s.bases
      .filter((b) => b.partial)
      .map((b) => ({
        kind: 'partial' as const,
        text: `${baseName(b.base)} na busca #${s.searchId} devolveu o limite pedido (${b.count}): a busca pode ser parcial.`,
      })),
  );
  return result;
}

function removedBox(searches: SearchContribution[], duplicates: Article[]): PrismaBox {
  const known = searches.filter((s) => s.unique !== null);
  const unknown = searches.filter((s) => s.unique === null);
  const between = sum(known.map((s) => s.found - s.unique!));
  const already = sum(known.map((s) => s.unique! - s.added!));
  const result = box('removed', 'Registros removidos antes da triagem', REMOVED_HOW, duplicates, [
    { label: 'Duplicados entre bases', n: unknown.length ? null : between },
    { label: 'Já estavam no projeto (buscas anteriores)', n: unknown.length ? null : already },
    { label: 'Marcados como duplicado na triagem', n: duplicates.length },
  ]);
  result.n = between + already + duplicates.length;
  if (unknown.length) {
    const which = unknown.map((s) => `#${s.searchId}`).join(', ');
    result.warnings.push({
      kind: 'nodata',
      text: `Busca ${which}: salva antes de o app registrar quantos resultados eram únicos e novos. Os duplicados dela ficam "sem dados", nunca estimados, e esta etapa não pode ser conferida.`,
    });
  }
  return result;
}

const IDENTIFIED_HOW =
  'Soma dos resultados de cada base em todas as buscas salvas do projeto, antes de tirar duplicados, mais os registros de outras fontes: os artigos adicionados fora das buscas (contados pelo app) ou o número digitado à mão.';
const REMOVED_HOW =
  'Duplicados que a busca juntou entre bases, resultados que já estavam no projeto quando a busca foi salva e artigos marcados como duplicado na triagem.';
const SCREENED_HOW =
  'Artigos do projeto que entram na triagem por título e resumo: todos, menos os marcados como duplicado.';
const EXCLUDED_HOW =
  'Artigos com rótulo de exclusão na triagem por título e resumo, mais os arquivados na página do projeto sem rótulo, que aparecem como categoria própria em vez de sumir.';
const SOUGHT_HOW = 'Artigos incluídos na triagem por título e resumo, que seguem para o texto completo.';
const NOT_RETRIEVED_HOW = 'Artigos com o rótulo "Texto completo não recuperado" na etapa de texto completo.';
const ASSESSED_HOW = 'Buscados menos não recuperados: os textos completos a ler e decidir.';
const REASONS_HOW = 'Artigos com rótulo de exclusão na etapa de texto completo, agrupados pelo rótulo, que é o motivo.';
const INCLUDED_HOW = 'Artigos com rótulo de inclusão na etapa de texto completo.';

function mismatch(target: PrismaBox, text: string): void {
  target.warnings.push({ kind: 'mismatch', text });
}

function screeningBoxes(input: PrismaInput, d: Decisions) {
  const duplicates = d.withKind(input.articles, 'title', 'removed');
  const pool = input.articles.filter((a) => !duplicates.includes(a));
  const unlabeled = pool.filter(
    (a) => a.status === 'archived' && !d.labelAt(a.id, 'title') && !d.labelAt(a.id, 'full'),
  );
  const excludedTitle = d.withKind(pool, 'title', 'exclude');
  const excluded = box(
    'excluded',
    'Registros excluídos',
    EXCLUDED_HOW,
    [...excludedTitle, ...unlabeled],
    [
      ...groupByLabel(excludedTitle, d, 'title'),
      ...(unlabeled.length ? [{ label: 'Arquivado sem rótulo', n: unlabeled.length }] : []),
    ],
  );
  const sought = d.withKind(pool, 'title', 'include');
  const pendingTitle = pool.filter((a) => !excluded.articleIds.includes(a.id) && !sought.includes(a));
  return { duplicates, pool, excluded, sought, pendingTitle };
}

function fullTextBoxes(sought: Article[], d: Decisions) {
  const notRetrieved = sought.filter((a) => d.labelAt(a.id, 'full')?.preset_key === NOT_RETRIEVED_KEY);
  const assessed = sought.filter((a) => !notRetrieved.includes(a));
  const reasonsArticles = d.withKind(assessed, 'full', 'exclude');
  const included = d.withKind(assessed, 'full', 'include');
  const pendingFull = assessed.filter((a) => !reasonsArticles.includes(a) && !included.includes(a));
  return {
    notRetrieved: box('notRetrieved', 'Relatórios não recuperados', NOT_RETRIEVED_HOW, notRetrieved),
    assessed: box('assessed', 'Relatórios avaliados para elegibilidade', ASSESSED_HOW, assessed),
    reasons: box(
      'reasons',
      'Relatórios excluídos',
      REASONS_HOW,
      reasonsArticles,
      groupByLabel(reasonsArticles, d, 'full'),
    ),
    included: box('included', 'Estudos incluídos na revisão', INCLUDED_HOW, included),
    pendingFull,
  };
}

function checkScreened(flow: PrismaFlow, pendingTitle: Article[]): void {
  const { identified, removed, screened, excluded, sought } = flow;
  if (!removed.warnings.some((w) => w.kind === 'nodata') && identified.n - removed.n !== screened.n) {
    mismatch(
      screened,
      `Pela identificação, entrariam ${identified.n - removed.n} na triagem (${identified.n} − ${removed.n}); o projeto tem ${screened.n}. A diferença pode ser de artigos apagados ou de outras fontes contadas à mão.`,
    );
  }
  if (pendingTitle.length) {
    mismatch(
      screened,
      `Não fecha: ${screened.n} triados ≠ ${excluded.n} excluídos + ${sought.n} buscados. ${pendingTitle.length} sem decisão ou em dúvida no título e resumo.`,
    );
  }
}

function checkAssessed(flow: PrismaFlow, pendingFull: Article[]): void {
  const { assessed, reasons, included } = flow;
  if (pendingFull.length) {
    mismatch(
      assessed,
      `Não fecha: ${assessed.n} avaliados ≠ ${reasons.n} excluídos + ${included.n} incluídos. ${pendingFull.length} sem decisão ou em dúvida no texto completo.`,
    );
  }
}

/**
 * The PRISMA 2020 flow of a project (#50), from its saved searches, articles, labels, decisions and the numbers
 * typed by hand. Every box says which articles make it up and how it is counted; where outputs do not add up to
 * the input it says so, and it never corrects a number.
 *
 * @example const flow = prismaFlow({ searches, articles, labels, decisions, manual }); flow.included.n // 11
 */
export function prismaFlow(input: PrismaInput): PrismaFlow {
  const d = new Decisions(input);
  const searches = input.searches.map(searchContribution);
  const screening = screeningBoxes(input, d);
  const full = fullTextBoxes(screening.sought, d);
  const flow: PrismaFlow = {
    searches,
    identified: identifiedBox(input, searches),
    removed: removedBox(searches, screening.duplicates),
    screened: box('screened', 'Registros triados', SCREENED_HOW, screening.pool),
    excluded: screening.excluded,
    sought: box('sought', 'Relatórios buscados para recuperação', SOUGHT_HOW, screening.sought),
    notRetrieved: full.notRetrieved,
    assessed: full.assessed,
    reasons: full.reasons,
    included: full.included,
  };
  checkScreened(flow, screening.pendingTitle);
  checkAssessed(flow, full.pendingFull);
  return flow;
}

/** The boxes in reading order: down the main column, each followed by the box it sends articles out to. */
export const PRISMA_ORDER: readonly PrismaBoxKey[] = [
  'identified',
  'removed',
  'screened',
  'excluded',
  'sought',
  'notRetrieved',
  'assessed',
  'reasons',
  'included',
];

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/**
 * The data table that goes with an exported diagram: one row per box and per line inside it, with how it is
 * counted and its warnings. "sem dados" where a number is unknown.
 *
 * @example prismaTableCsv(flow).split('\n')[0] // '"Caixa","Linha","n","De onde vem","Aviso"'
 */
export function prismaTableCsv(flow: PrismaFlow): string {
  const rows: (string | number)[][] = [['Caixa', 'Linha', 'n', 'De onde vem', 'Aviso']];
  for (const key of PRISMA_ORDER) {
    const b = flow[key];
    rows.push([b.title, '', b.n, b.how, b.warnings.map((w) => w.text).join(' | ')]);
    for (const line of b.lines) rows.push([b.title, line.label, line.n ?? 'sem dados', line.note ?? '', '']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
