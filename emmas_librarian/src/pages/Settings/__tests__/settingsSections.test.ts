import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, isSettingsSection, keysCount, sectionOf } from '../settingsSections';

describe('settingsSections', () => {
  it('lists the six sections of the canvas in order', () => {
    expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual([
      'appearance',
      'keys',
      'ai',
      'backup',
      'updates',
      'trash',
    ]);
  });

  it('knows which path segments name a section, and falls back to the first', () => {
    expect(isSettingsSection('ai')).toBe(true);
    expect(isSettingsSection('x')).toBe(false);
    expect(sectionOf('backup')).toBe('backup');
    expect(sectionOf(undefined)).toBe('appearance');
    expect(sectionOf('inexistente')).toBe('appearance');
  });

  it('counts the keys that are filled in, a blank one not counting', () => {
    expect(keysCount(['abc', '', 'x', '  '])).toBe('2/4');
    expect(keysCount([])).toBe('0/0');
  });
});
