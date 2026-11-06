import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  readAppearance,
  saveAppearance,
  titleBarColors,
  type Appearance,
} from '../appearance';
import { commitAppearance } from '../useAppearance';
import { MemoryAppearanceStorage, RecordingTitleBar } from './fakes/appearanceFakes';

const DARK_WARM: Appearance = { mode: 'dark', lightTone: 'white', darkTone: 'warm', accent: 'green' };

describe('appearance (Arca 134)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('html');
  });

  it('starts in white light mode with the blue accent when nothing was saved', () => {
    expect(readAppearance(new MemoryAppearanceStorage())).toEqual(DEFAULT_APPEARANCE);
  });

  it('keeps the mode and accent saved by earlier versions under their old keys', () => {
    const storage = new MemoryAppearanceStorage({ theme: 'dark', accent: 'pink' });

    expect(readAppearance(storage)).toEqual({ mode: 'dark', lightTone: 'white', darkTone: 'neutral', accent: 'pink' });
  });

  it('ignores unknown saved values instead of applying them', () => {
    const storage = new MemoryAppearanceStorage({ theme: 'sepia', theme_light_tone: 'x', theme_dark_tone: 'slate' });

    expect(readAppearance(storage)).toEqual(DEFAULT_APPEARANCE);
  });

  it('reads back what it saved', () => {
    const storage = new MemoryAppearanceStorage();

    saveAppearance(storage, DARK_WARM);

    expect(readAppearance(storage)).toEqual(DARK_WARM);
  });

  it('marks the root with the mode, the tone of that mode and the accent', () => {
    applyAppearance(root, DARK_WARM);
    expect([root.dataset.theme, root.dataset.tone, root.dataset.accent]).toEqual(['dark', 'warm', 'green']);

    applyAppearance(root, { ...DARK_WARM, mode: 'light' });
    expect([root.dataset.theme, root.dataset.tone]).toEqual(['light', 'white']);
  });

  it('takes the title bar colours from the page background and text tokens', () => {
    root.style.setProperty('--bg-main', ' #161413');
    root.style.setProperty('--text-main', '#e7e5e4 ');

    expect(titleBarColors(root)).toEqual({ color: '#161413', symbolColor: '#e7e5e4' });
  });

  it('saves, applies and recolours the title bar in one step', () => {
    const storage = new MemoryAppearanceStorage();
    const bar = new RecordingTitleBar();
    root.style.setProperty('--bg-main', '#141416');
    root.style.setProperty('--text-main', '#e4e4e7');

    commitAppearance({ storage, root, updateTitleBar: bar.update }, DARK_WARM);

    expect(storage.getItem('theme_dark_tone')).toBe('warm');
    expect(root.dataset.tone).toBe('warm');
    expect(bar.calls).toEqual([{ color: '#141416', symbolColor: '#e4e4e7' }]);
  });
});
