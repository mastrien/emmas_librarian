import type { Article, ScreeningKind } from '../../types';
import type { ReviewRow } from '../../utils/screeningView';

/** How each kind is titled in the label menus. */
export const KIND_MENU_TITLE: Readonly<Record<ScreeningKind, string>> = {
  include: 'Incluir',
  maybe: 'Em dúvida',
  exclude: 'Excluir (arquiva no projeto)',
  removed: 'Remover antes da triagem',
};

/** How each kind is described in the labels window. */
export const KIND_EXPLAINED: Readonly<Record<ScreeningKind, string>> = {
  include: 'cada um vira uma seção na revisão',
  maybe: 'fica à parte até você decidir',
  exclude: 'arquiva o artigo no projeto; o nome vira o motivo',
  removed: 'duplicados e afins; o PRISMA conta à parte, antes da triagem',
};

/** The kind as a short word beside a section title. */
export const KIND_WORD: Readonly<Record<ScreeningKind, string>> = {
  include: 'rótulo de inclusão',
  maybe: 'rótulo de dúvida',
  exclude: 'exclusão',
  removed: 'removido antes da triagem',
};

/**
 * Authors, year and journal of an article in one line.
 *
 * @example articleMeta({ authors: 'Shi, X.', year: 2015, journal: 'NeurIPS' } as Article) // 'Shi, X. · 2015 · NeurIPS'
 */
export function articleMeta(article: Article): string {
  return [article.authors, article.year ?? 's/ ano', article.journal].filter(Boolean).join(' · ');
}

/**
 * The bases an article came from. Searches store a JSON list; older imports a comma-separated text.
 *
 * @example databasesOf({ source_databases: '["openalex","scopus"]' } as Article) // ['openalex', 'scopus']
 */
export function databasesOf(article: Article): string[] {
  const raw = article.source_databases?.trim() ?? '';
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Not JSON: a plain list typed or imported before searches stored JSON.
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when the article was read on the project page, also when the triage archived it after that. */
export function wasRead(row: ReviewRow): boolean {
  return row.article.status === 'read' || row.decision?.status_before === 'read';
}

/**
 * "1 artigo" / "3 artigos".
 *
 * @example articlesCount(3) // '3 artigos'
 */
export function articlesCount(n: number): string {
  return n === 1 ? '1 artigo' : `${n} artigos`;
}
