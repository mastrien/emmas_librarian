import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AppearanceSettings } from '../AppearanceSettings';
import type { AppearanceDeps } from '../../../../theme/useAppearance';
import { MemoryAppearanceStorage, RecordingTitleBar } from '../../../../theme/__tests__/fakes/appearanceFakes';

describe('AppearanceSettings (Arca 134)', () => {
  let storage: MemoryAppearanceStorage;
  let bar: RecordingTitleBar;
  let deps: AppearanceDeps;

  beforeEach(() => {
    storage = new MemoryAppearanceStorage();
    bar = new RecordingTitleBar();
    deps = { storage, root: document.createElement('html'), updateTitleBar: bar.update };
  });

  const tones = (group: string) =>
    within(screen.getByRole('group', { name: group }))
      .getAllByRole('button')
      .map((b) => b.textContent?.replace('Aa', ''));
  const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

  it('offers white or warm white for light mode and neutral or warm graphite for dark mode', () => {
    render(<AppearanceSettings deps={deps} />);

    expect(tones('Tom do modo claro')).toEqual(['Branco', 'Branco quente']);
    expect(tones('Tom do modo escuro')).toEqual(['Grafite neutro', 'Grafite quente']);
    expect([pressed('Modo Claro'), pressed('Branco'), pressed('Grafite neutro')]).toEqual(['true', 'true', 'true']);
  });

  it('saves the dark tone while in light mode and uses it once dark mode is chosen', () => {
    render(<AppearanceSettings deps={deps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Grafite quente' }));
    expect(storage.getItem('theme_dark_tone')).toBe('warm');
    expect(deps.root.dataset.tone).toBe('white');

    fireEvent.click(screen.getByRole('button', { name: /Modo Escuro/ }));
    expect([deps.root.dataset.theme, deps.root.dataset.tone]).toEqual(['dark', 'warm']);
    expect(storage.getItem('theme')).toBe('dark');
  });

  it('applies the warm white tone to light mode at once', () => {
    render(<AppearanceSettings deps={deps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Branco quente' }));

    expect(deps.root.dataset.tone).toBe('warm');
    expect(pressed('Branco quente')).toBe('true');
    expect(bar.calls).toHaveLength(1);
  });

  it('keeps the accent choice', () => {
    render(<AppearanceSettings deps={deps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Verde' }));

    expect(deps.root.dataset.accent).toBe('green');
    expect(storage.getItem('accent')).toBe('green');
    expect(pressed('Verde')).toBe('true');
  });
});
