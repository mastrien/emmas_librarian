import type { Article } from '../../../../types';
import { splitAuthorNames } from '../../../../utils/authors';

// The facts of the article details panel (board 153), as text: each one says color, icon AND label in the panel,
// so these labels are what a screen reader reads.

const STATUS_NAMES: Record<string, string> = { new: 'Ativo', read: 'Lido', archived: 'Arquivado' };

/**
 * The article's status in words; articles saved before the status column existed count as active.
 *
 * @example statusName({ status: 'read' } as Article) // 'Lido'
 */
export function statusName(article: Pick<Article, 'status'>): string {
  return STATUS_NAMES[article.status ?? 'new'] ?? 'Ativo';
}

/**
 * Open or closed access, only when the base reported it (null for Crossref, WoS and manual articles).
 *
 * @example accessName({ is_oa: 1 } as Article) // 'Aberto'
 */
export function accessName(article: Pick<Article, 'is_oa'>): string | null {
  if (article.is_oa === 1) return 'Aberto';
  return article.is_oa === 0 ? 'Fechado' : null;
}

export interface AuthorsPreview {
  shown: string[];
  hidden: number;
}

/**
 * The first five authors and how many more (board 153: "… Horányi A. +36 autores").
 *
 * @example authorsPreview('A; B; C; D; E; F') // { shown: ['A', 'B', 'C', 'D', 'E'], hidden: 1 }
 */
export function authorsPreview(authors?: string | null, visible = 5): AuthorsPreview {
  const names = splitAuthorNames(authors);
  return { shown: names.slice(0, visible), hidden: Math.max(0, names.length - visible) };
}

/**
 * "Journal · 2020", leaving out what is missing.
 *
 * @example venueLine({ journal: 'Nature', year: 2020 } as Article) // 'Nature · 2020'
 */
export function venueLine(article: Pick<Article, 'journal' | 'year'>): string {
  return [article.journal, article.year].filter(Boolean).join(' · ');
}
