import { describe, it, expect } from 'vitest';
import { applyLook, loadLook, saveLook } from '../theme';

class MapStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('look', () => {
  it('follows the phone’s dark setting the first time', () => {
    expect(loadLook(new MapStorage(), true).mode).toBe('dark');
    expect(loadLook(new MapStorage(), false).mode).toBe('light');
  });

  it('keeps what the person chose, whatever the phone’s setting says', () => {
    const storage = new MapStorage();
    saveLook(storage, { mode: 'light', lightTone: 'warm', darkTone: 'neutral', accent: 'pink' });
    expect(loadLook(storage, true)).toMatchObject({ mode: 'light', lightTone: 'warm', accent: 'pink' });
  });

  it('puts mode, tone and accent on the page for tokens.css', () => {
    const root = document.createElement('html');
    applyLook(root, { mode: 'dark', lightTone: 'white', darkTone: 'warm', accent: 'green' });
    expect([root.dataset.theme, root.dataset.tone, root.dataset.accent]).toEqual(['dark', 'warm', 'green']);
  });
});
