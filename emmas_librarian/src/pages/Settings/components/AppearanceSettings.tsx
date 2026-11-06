import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Appearance, DarkTone, LightTone, ThemeMode } from '../../../theme/appearance';
import { useAppearance, windowAppearanceDeps, type AppearanceDeps } from '../../../theme/useAppearance';
import './appearanceSettings.css';

const ACCENTS = [
  { id: 'blue', label: 'Azul' },
  { id: 'pink', label: 'Rosa' },
  { id: 'green', label: 'Verde' },
  { id: 'purple', label: 'Roxo' },
  { id: 'orange', label: 'Laranja' },
  { id: 'red', label: 'Vermelho' },
];

const LIGHT_TONES: { id: LightTone; label: string }[] = [
  { id: 'white', label: 'Branco' },
  { id: 'warm', label: 'Branco quente' },
];

const DARK_TONES: { id: DarkTone; label: string }[] = [
  { id: 'neutral', label: 'Grafite neutro' },
  { id: 'warm', label: 'Grafite quente' },
];

const ModeCard: React.FC<{ mode: ThemeMode; selected: boolean; onSelect: () => void }> = (props) => {
  const Icon = props.mode === 'light' ? Sun : Moon;
  return (
    <button type="button" className="appearance-mode" aria-pressed={props.selected} onClick={props.onSelect}>
      <Icon size={32} aria-hidden="true" />
      <span>{props.mode === 'light' ? 'Modo Claro' : 'Modo Escuro'}</span>
    </button>
  );
};

interface TonePickerProps<T extends string> {
  mode: ThemeMode;
  title: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (tone: T) => void;
}

// Each swatch carries its own data-theme/data-tone, so style.css paints it with that tone's real tokens.
function TonePicker<T extends string>({ mode, title, options, value, onChange }: TonePickerProps<T>) {
  return (
    <fieldset className="appearance-tones">
      <legend>{title}</legend>
      {options.map((tone) => (
        <button
          key={tone.id}
          type="button"
          className="appearance-tone"
          aria-pressed={value === tone.id}
          onClick={() => onChange(tone.id)}
        >
          <span className="appearance-tone-swatch" data-theme={mode} data-tone={tone.id} aria-hidden="true">
            <span>Aa</span>
          </span>
          {tone.label}
        </button>
      ))}
    </fieldset>
  );
}

const AccentPicker: React.FC<{ value: string; onChange: (accent: string) => void }> = ({ value, onChange }) => (
  <div className="appearance-accents">
    <h3>Cor de Destaque</h3>
    <div className="appearance-accent-list">
      {ACCENTS.map((accent) => (
        <button
          key={accent.id}
          type="button"
          className="appearance-accent"
          data-accent={accent.id}
          aria-pressed={value === accent.id}
          aria-label={accent.label}
          title={accent.label}
          onClick={() => onChange(accent.id)}
        />
      ))}
    </div>
  </div>
);

/**
 * Settings → Aparência: light or dark mode, the tone of each mode (Arca 134) and the accent colour. Every choice is
 * applied and saved at once. Tests pass their own storage and root through `deps`.
 *
 * @example <AppearanceSettings />
 */
export const AppearanceSettings: React.FC<{ deps?: AppearanceDeps }> = ({ deps = windowAppearanceDeps() }) => {
  const { appearance, change } = useAppearance(deps);
  const set = (update: Partial<Appearance>) => () => change(update);
  return (
    <div className="card appearance-settings">
      <h2>Aparência</h2>
      <div className="appearance-modes">
        <ModeCard mode="light" selected={appearance.mode === 'light'} onSelect={set({ mode: 'light' })} />
        <ModeCard mode="dark" selected={appearance.mode === 'dark'} onSelect={set({ mode: 'dark' })} />
      </div>
      <div className="appearance-tone-groups">
        <TonePicker
          mode="light"
          title="Tom do modo claro"
          options={LIGHT_TONES}
          value={appearance.lightTone}
          onChange={(lightTone) => change({ lightTone })}
        />
        <TonePicker
          mode="dark"
          title="Tom do modo escuro"
          options={DARK_TONES}
          value={appearance.darkTone}
          onChange={(darkTone) => change({ darkTone })}
        />
      </div>
      <AccentPicker value={appearance.accent} onChange={(accent) => change({ accent })} />
    </div>
  );
};
