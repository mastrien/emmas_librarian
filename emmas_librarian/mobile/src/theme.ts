import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  readAppearance,
  saveAppearance,
  type Appearance,
  type AppearanceStorage,
} from '../../src/theme/appearance';

/**
 * The phone's look: the same choices as the desktop (mode, tone, accent), kept in the browser's storage and put on
 * the page as attributes that tokens.css reads. The first time, the mode follows the phone's own setting.
 *
 * @example const look = loadLook(localStorage, prefersDark); applyLook(document.documentElement, look);
 */
export function loadLook(storage: AppearanceStorage, systemPrefersDark: boolean): Appearance {
  const saved = readAppearance(storage);
  const everChosen = storage.getItem('theme') !== null;
  return everChosen ? saved : { ...DEFAULT_APPEARANCE, mode: systemPrefersDark ? 'dark' : 'light' };
}

export function applyLook(root: HTMLElement, look: Appearance): void {
  applyAppearance(root, look);
}

export function saveLook(storage: AppearanceStorage, look: Appearance): void {
  saveAppearance(storage, look);
}

export type { Appearance };
