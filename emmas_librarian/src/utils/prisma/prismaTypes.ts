import type { Article, PrismaRecords, ScreeningDecision, ScreeningLabel, SearchHistoryItem } from '../../types';
import type { SearchContribution } from '../prismaSearches';

/** Boxes of the databases column, of the "other methods" column, and the included box both columns reach. */
export type PrismaBoxKey =
  | 'identified'
  | 'removed'
  | 'screened'
  | 'excluded'
  | 'sought'
  | 'notRetrieved'
  | 'assessed'
  | 'reasons'
  | 'omIdentified'
  | 'omSought'
  | 'omNotRetrieved'
  | 'omAssessed'
  | 'omReasons'
  | 'included';

/** The two identification columns of PRISMA 2020, and the included box that belongs to both. */
export type PrismaColumn = 'databases' | 'other' | 'both';

/** A line inside a box; `n` null means "sem dados", never an estimate. */
export interface PrismaLine {
  label: string;
  n: number | null;
  note?: string;
}

/**
 * mismatch: two numbers that should agree do not; pending: decisions or origins are still missing, the numbers
 * are right; partial: a base hit its limit; nodata: an old search cannot be checked.
 */
export interface PrismaWarning {
  kind: 'mismatch' | 'pending' | 'partial' | 'nodata';
  text: string;
}

/** One box: its number, the lines drawn in it, the finer lines only the panel and the table show, and why. */
export interface PrismaBox {
  key: PrismaBoxKey;
  column: PrismaColumn;
  title: string;
  n: number;
  lines: PrismaLine[];
  details: PrismaLine[];
  how: string;
  warnings: PrismaWarning[];
  articleIds: number[];
}

export interface PrismaInput {
  searches: SearchHistoryItem[];
  articles: Article[];
  labels: ScreeningLabel[];
  decisions: ScreeningDecision[];
  records: PrismaRecords;
}

export type PrismaFlow = Record<PrismaBoxKey, PrismaBox> & {
  searches: SearchContribution[];
  /** Whether any article came from outside the searches: without them PRISMA draws one column only. */
  otherMethods: boolean;
};

/** Preset key of the label PRISMA 2020 reports as its own box, "reports not retrieved". */
export const NOT_RETRIEVED_KEY = 'prisma2020.not-retrieved';
