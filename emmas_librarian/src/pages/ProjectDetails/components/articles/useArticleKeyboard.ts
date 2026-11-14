import { useEffect, useState } from 'react';
import type { Article } from '../../../../types';
import { keyBelongsElsewhere } from './keyboardTargets';

interface ArticleKeyboardActions {
  onOpen: (article: Article) => void;
  onToggleSelection: (article: Article) => void;
  /** Space: show or hide the details panel for the current row. */
  onToggleDetails: (article: Article) => void;
  /** Escape: close the details panel. */
  onEscape: () => void;
}

const step = (key: string): number => ({ j: 1, J: 1, k: -1, K: -1 })[key] ?? 0;

// Enter on a focused button or link belongs to that control (the "⋯" reached with Tab must open its menu).
const onControl = (event: KeyboardEvent): boolean =>
  event.target instanceof Element && event.target.closest('button, a, [role="button"], summary') !== null;

/**
 * Keyboard-first article list (board 153: "J K linha · Enter ler · X selecionar", "Espaço" on the details): J and K
 * move the current row, Enter opens it, X selects it, Space shows its details, Escape closes them. Returns the
 * current row's index, -1 before the first key.
 *
 * @example const current = useArticleKeyboard(pageArticles, { onOpen, onToggleSelection });
 */
export function useArticleKeyboard(rows: Article[], actions: ArticleKeyboardActions): number {
  const [current, setCurrent] = useState(-1);
  const index = Math.min(current, rows.length - 1);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keyBelongsElsewhere(event) || rows.length === 0) return;
      const move = step(event.key);
      if (move) setCurrent((i) => Math.max(0, Math.min(rows.length - 1, i + move)));
      else if (event.key === 'Enter' && index >= 0 && !onControl(event)) actions.onOpen(rows[index]);
      else if ((event.key === 'x' || event.key === 'X') && index >= 0) actions.onToggleSelection(rows[index]);
      else if (event.key === ' ' && index >= 0 && !onControl(event)) actions.onToggleDetails(rows[index]);
      else if (event.key === 'Escape') actions.onEscape();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, index, actions]);

  return index;
}
