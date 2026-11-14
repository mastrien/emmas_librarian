/**
 * The app's look: light or dark mode, the tone of each mode and the accent colour. Kept in localStorage, as the mode
 * and accent always were, and applied as attributes on <html> that style.css reads (data-theme, data-tone,
 * data-accent). The tones were chosen by the author at the redesign (Arca 134): white or warm white in light mode,
 * neutral or warm graphite in dark mode.
 */

export type ThemeMode = 'light' | 'dark';
export type LightTone = 'white' | 'warm';
export type DarkTone = 'neutral' | 'warm';

export interface Appearance {
  mode: ThemeMode;
  lightTone: LightTone;
  darkTone: DarkTone;
  accent: string;
}

/** The colours the native title bar overlay needs, read from the page so they always match the tone. */
export interface TitleBarColors {
  color: string;
  symbolColor: string;
}

export type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const DEFAULT_APPEARANCE: Appearance = {
  mode: 'light',
  lightTone: 'white',
  darkTone: 'neutral',
  accent: 'blue',
};

// 'theme' and 'accent' are the keys earlier versions already wrote; changing them would reset everyone's choice.
const STORAGE_KEYS: Record<keyof Appearance, string> = {
  mode: 'theme',
  lightTone: 'theme_light_tone',
  darkTone: 'theme_dark_tone',
  accent: 'accent',
};

function pick<T extends string>(stored: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((value) => value === stored) ?? fallback;
}

/**
 * The saved appearance; anything missing or unknown falls back to the default (white light mode, blue accent).
 *
 * @example readAppearance(localStorage) // { mode: 'dark', lightTone: 'white', darkTone: 'warm', accent: 'blue' }
 */
export function readAppearance(storage: AppearanceStorage): Appearance {
  return {
    mode: pick(storage.getItem(STORAGE_KEYS.mode), ['light', 'dark'], DEFAULT_APPEARANCE.mode),
    lightTone: pick(storage.getItem(STORAGE_KEYS.lightTone), ['white', 'warm'], DEFAULT_APPEARANCE.lightTone),
    darkTone: pick(storage.getItem(STORAGE_KEYS.darkTone), ['neutral', 'warm'], DEFAULT_APPEARANCE.darkTone),
    accent: storage.getItem(STORAGE_KEYS.accent) || DEFAULT_APPEARANCE.accent,
  };
}

/**
 * Saves every field of the appearance.
 *
 * @example saveAppearance(localStorage, { ...current, darkTone: 'warm' })
 */
export function saveAppearance(storage: AppearanceStorage, appearance: Appearance): void {
  (Object.keys(STORAGE_KEYS) as (keyof Appearance)[]).forEach((key) =>
    storage.setItem(STORAGE_KEYS[key], appearance[key]),
  );
}

/** The tone of the mode in use: the CSS only needs that one. */
export function activeTone(appearance: Appearance): LightTone | DarkTone {
  return appearance.mode === 'dark' ? appearance.darkTone : appearance.lightTone;
}

/**
 * Puts the appearance on the root element, where style.css picks the colour tokens from.
 *
 * @example applyAppearance(document.documentElement, readAppearance(localStorage))
 */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  root.setAttribute('data-theme', appearance.mode);
  root.setAttribute('data-tone', activeTone(appearance));
  root.setAttribute('data-accent', appearance.accent);
}

/**
 * The colours of the OS window buttons: the title bar's sunken background (redesign, board 150) and the
 * text colour, so the buttons blend into the app's own title bar.
 *
 * @example titleBarColors(document.documentElement) // { color: '#0f0f11', symbolColor: '#e4e4e7' }
 */
export function titleBarColors(root: HTMLElement): TitleBarColors {
  const style = getComputedStyle(root);
  return {
    color: style.getPropertyValue('--bg-sunken').trim(),
    symbolColor: style.getPropertyValue('--text-main').trim(),
  };
}
