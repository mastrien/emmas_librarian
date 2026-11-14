import { useState } from 'react';
import type { Article } from '../../../../types';

export interface ArticleSelectionState {
  selecting: boolean;
  /** The selected articles that the filters still list. */
  selected: Article[];
  isSelected: (id: number) => boolean;
  toggle: (id: number) => void;
  setMany: (articles: Article[], on: boolean) => void;
  start: () => void;
  exit: () => void;
}

/**
 * Multi-select state. Only articles still in the filtered list count as selected, so an article that was archived
 * or filtered out leaves the selection by itself.
 *
 * @example const selection = useArticleSelection(filtering.activeArticles);
 */
export function useArticleSelection(listed: Article[]): ArticleSelectionState {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<Set<number>>(new Set());
  const change = (apply: (next: Set<number>) => void) =>
    setIds((prev) => {
      const next = new Set(prev);
      apply(next);
      return next;
    });
  return {
    selecting,
    selected: listed.filter((a) => ids.has(a.id)),
    isSelected: (id) => ids.has(id),
    toggle: (id) => change((next) => (next.has(id) ? next.delete(id) : next.add(id))),
    setMany: (articles, on) => change((next) => articles.forEach((a) => (on ? next.add(a.id) : next.delete(a.id)))),
    start: () => setSelecting(true),
    exit: () => {
      setSelecting(false);
      setIds(new Set());
    },
  };
}
