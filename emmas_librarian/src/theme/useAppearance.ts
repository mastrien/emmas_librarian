import { useState } from 'react';
import {
  applyAppearance,
  readAppearance,
  saveAppearance,
  titleBarColors,
  type Appearance,
  type AppearanceStorage,
  type TitleBarColors,
} from './appearance';

export interface AppearanceDeps {
  storage: AppearanceStorage;
  root: HTMLElement;
  /** Recolours the native title bar; absent outside Electron. */
  updateTitleBar?: (colors: TitleBarColors) => void;
}

/**
 * Applies a new appearance everywhere it lives: storage, the root element and the native title bar.
 *
 * @example commitAppearance({ storage: localStorage, root: document.documentElement }, next)
 */
export function commitAppearance(deps: AppearanceDeps, appearance: Appearance): void {
  saveAppearance(deps.storage, appearance);
  applyAppearance(deps.root, appearance);
  deps.updateTitleBar?.(titleBarColors(deps.root));
}

/**
 * The appearance as React state; `change` saves and applies a partial update at once.
 *
 * @example const { appearance, change } = useAppearance(deps); change({ darkTone: 'warm' });
 */
export function useAppearance(deps: AppearanceDeps) {
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance(deps.storage));
  const change = (update: Partial<Appearance>) => {
    const next = { ...appearance, ...update };
    commitAppearance(deps, next);
    setAppearance(next);
  };
  return { appearance, change };
}

/**
 * The real storage, root and title bar of this window. Outside Electron (tests, a plain browser) there is no title bar.
 *
 * @example const { appearance, change } = useAppearance(windowAppearanceDeps());
 */
export function windowAppearanceDeps(win: Window = window): AppearanceDeps {
  const api = win.electronAPI as Window['electronAPI'] | undefined;
  return {
    storage: win.localStorage,
    root: win.document.documentElement,
    updateTitleBar: api
      ? (colors) =>
          void api
            .invoke('UPDATE_TITLE_BAR', colors)
            // A failed recolour leaves the old bar; nothing else depends on it.
            .catch((err: unknown) =>
              console.error(JSON.stringify({ event: 'title_bar_update_failed', colors, error: String(err) })),
            )
      : undefined,
  };
}
