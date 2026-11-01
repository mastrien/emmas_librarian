import type { Article, PrismaRecords, SearchHistoryItem } from '../types';
import { isOutsideSearchBreakdown } from './outsideSearchEntries';
import { searchContribution } from './prismaSearches';
import { box, Decisions } from './prisma/prismaDecisions';
import { databaseColumn } from './prisma/prismaDatabaseColumn';
import { otherColumn } from './prisma/prismaOtherColumn';
import type { PrismaBox, PrismaBoxKey, PrismaFlow, PrismaInput, PrismaLine } from './prisma/prismaTypes';

export * from './prisma/prismaTypes';
export { brazilianDate } from './prisma/prismaDecisions';
export { METHOD_NAMES } from './prisma/prismaOtherColumn';

function breakdownOf(search: SearchHistoryItem): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(search.results_breakdown || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Splits the history into structured searches and entries that only logged articles brought from outside one
 * (added by hand, a batch of PDFs, a copy from another project). Articles with no history entry at all predate
 * it, so where they came from is unknown: they go with the outside ones, to be told.
 *
 * @example splitBySource(input).outside.map((a) => a.id) // [7, 9]
 */
export function splitBySource(input: Pick<PrismaInput, 'searches' | 'articles'>) {
  const outsideIds = new Set(input.searches.filter((s) => isOutsideSearchBreakdown(breakdownOf(s))).map((s) => s.id));
  const isOutside = (a: Article) => !a.search_id || outsideIds.has(a.search_id);
  return {
    searches: input.searches.filter((s) => !outsideIds.has(s.id)),
    fromSearches: input.articles.filter((a) => !isOutside(a)),
    outside: input.articles.filter(isOutside),
  };
}

const INCLUDED = {
  title: 'Estudos incluídos na revisão',
  how: 'Publicações com rótulo de inclusão no texto completo, das duas colunas. Os estudos são as publicações menos as que você marcou como do mesmo estudo.',
};

// A study is named by its first article; publications with no link are a study each.
function includedBox(publications: Article[], records: PrismaRecords): PrismaBox {
  const studyOf = new Map(records.studyLinks.map((l) => [l.article_id, l.study_article_id]));
  const groups = new Map<number, Article[]>();
  for (const p of publications) {
    const study = studyOf.get(p.id) ?? p.id;
    groups.set(study, [...(groups.get(study) ?? []), p]);
  }
  const result = box('included', 'both', INCLUDED, publications, [
    { label: 'Publicações dos estudos incluídos', n: publications.length },
  ]);
  result.n = groups.size;
  result.details = [...groups.values()]
    .filter((members) => members.length > 1)
    .map(
      (members): PrismaLine => ({ label: `1 estudo: ${members.map((m) => m.title).join(' + ')}`, n: members.length }),
    );
  return result;
}

/**
 * The PRISMA 2020 flow of a project (#50), from its saved history, articles, labels, decisions and what the
 * person told about sources and studies. Every box says which articles make it up and how it is counted; where
 * outputs do not add up to the input it says why, and it never corrects a number.
 *
 * @example const flow = prismaFlow({ searches, articles, labels, decisions, records }); flow.included.n // 13
 */
export function prismaFlow(input: PrismaInput): PrismaFlow {
  const d = new Decisions(input);
  const split = splitBySource(input);
  const searches = split.searches.map(searchContribution);
  const databases = databaseColumn(split.fromSearches, searches, d);
  const other = otherColumn(split.outside, input.records, d);
  return {
    searches,
    otherMethods: split.outside.length > 0,
    ...databases.boxes,
    ...other.boxes,
    included: includedBox([...databases.included, ...other.included], input.records),
  };
}

const DATABASE_ORDER: readonly PrismaBoxKey[] = [
  'identified',
  'removed',
  'screened',
  'excluded',
  'sought',
  'notRetrieved',
  'assessed',
  'reasons',
];
const OTHER_ORDER: readonly PrismaBoxKey[] = ['omIdentified', 'omSought', 'omNotRetrieved', 'omAssessed', 'omReasons'];

/**
 * The boxes in reading order: down the databases column, each followed by the box it sends articles out to,
 * then the "other methods" column when the project has one, then the included box.
 *
 * @example prismaOrder(flow).at(-1) // 'included'
 */
export function prismaOrder(flow: Pick<PrismaFlow, 'otherMethods'>): PrismaBoxKey[] {
  return [...DATABASE_ORDER, ...(flow.otherMethods ? OTHER_ORDER : []), 'included'];
}
