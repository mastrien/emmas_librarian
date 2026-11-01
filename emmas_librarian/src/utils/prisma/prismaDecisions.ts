import type { Article, ScreeningKind, ScreeningLabel, ScreeningStage } from '../../types';
import type { PrismaBox, PrismaBoxKey, PrismaColumn, PrismaInput, PrismaLine } from './prismaTypes';

/** The decisions and labels of the project, read the same way by every box. */
export class Decisions {
  constructor(private readonly input: Pick<PrismaInput, 'decisions' | 'labels'>) {}

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

  /** Archived on the project page without any label: shown as a category of its own instead of vanishing. */
  archivedUnlabeled(articles: Article[]): Article[] {
    return articles.filter(
      (a) => a.status === 'archived' && !this.labelAt(a.id, 'title') && !this.labelAt(a.id, 'full'),
    );
  }
}

export const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);

/**
 * Counts articles by the name of their label at a stage, in the order the names first appear.
 *
 * @example groupByLabel(excluded, decisions, 'full') // [{ label: 'População diferente', n: 6 }]
 */
export function groupByLabel(articles: Article[], decisions: Decisions, stage: ScreeningStage): PrismaLine[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    const name = decisions.labelAt(article.id, stage)?.name ?? '';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, n]) => ({ label, n }));
}

/** A box made of these articles, its number their count until a caller says otherwise. */
export function box(
  key: PrismaBoxKey,
  column: PrismaColumn,
  text: { title: string; how: string },
  articles: Article[],
  lines: PrismaLine[] = [],
): PrismaBox {
  return {
    key,
    column,
    ...text,
    n: articles.length,
    lines,
    details: [],
    warnings: [],
    articleIds: articles.map((a) => a.id),
  };
}

/**
 * A stored SQLite date as Brazilians write it.
 *
 * @example brazilianDate('2026-10-30 08:00:00') // '30/10/2026'
 */
export function brazilianDate(stored: string): string {
  const [year, month, day] = stored.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : stored;
}
