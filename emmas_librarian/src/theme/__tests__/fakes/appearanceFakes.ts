import type { AppearanceStorage, TitleBarColors } from '../../appearance';

/**
 * In-memory localStorage for appearance tests: no state leaks between tests.
 *
 * @example const storage = new MemoryAppearanceStorage({ theme: 'dark' });
 */
export class MemoryAppearanceStorage implements AppearanceStorage {
  readonly values: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/**
 * Stands in for Electron's title bar: records every recolour.
 *
 * @example const bar = new RecordingTitleBar(); deps.updateTitleBar = bar.update;
 */
export class RecordingTitleBar {
  readonly calls: TitleBarColors[] = [];
  update = (colors: TitleBarColors): void => {
    this.calls.push(colors);
  };
}
