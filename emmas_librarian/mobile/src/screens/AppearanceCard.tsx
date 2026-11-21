import React from 'react';
import type { Appearance } from '../theme';
import { useLook } from '../look/LookContext';

const ACCENTS: { id: string; name: string; color: string }[] = [
  { id: 'blue', name: 'Azul', color: '#4f46e5' },
  { id: 'pink', name: 'Rosa', color: '#db2777' },
  { id: 'green', name: 'Verde', color: '#059669' },
  { id: 'purple', name: 'Roxo', color: '#7c3aed' },
  { id: 'orange', name: 'Laranja', color: '#ea580c' },
  { id: 'red', name: 'Vermelho', color: '#dc2626' },
];

interface Choice<T extends string> {
  id: T;
  name: string;
}

const Segmented = <T extends string>(props: {
  label: string;
  value: T;
  options: Choice<T>[];
  onChange: (id: T) => void;
}) => (
  <div className="m-field">
    <h3 className="m-field__label">{props.label}</h3>
    <div className="m-segmented" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option.id}
          className="m-segmented__option"
          aria-pressed={option.id === props.value}
          onClick={() => props.onChange(option.id)}
        >
          {option.name}
        </button>
      ))}
    </div>
  </div>
);

const ToneChoice: React.FC<{ look: Appearance; onChange: (patch: Partial<Appearance>) => void }> = ({
  look,
  onChange,
}) =>
  look.mode === 'dark' ? (
    <Segmented
      label="Tom do modo escuro"
      value={look.darkTone}
      options={[
        { id: 'neutral', name: 'Grafite neutro' },
        { id: 'warm', name: 'Grafite quente' },
      ]}
      onChange={(darkTone) => onChange({ darkTone })}
    />
  ) : (
    <Segmented
      label="Tom do modo claro"
      value={look.lightTone}
      options={[
        { id: 'white', name: 'Branco' },
        { id: 'warm', name: 'Branco quente' },
      ]}
      onChange={(lightTone) => onChange({ lightTone })}
    />
  );

const AccentChoice: React.FC<{ current: string; onChange: (accent: string) => void }> = ({ current, onChange }) => (
  <div className="m-field">
    <h3 className="m-field__label">Cor de destaque</h3>
    <div className="m-swatches" role="group" aria-label="Cor de destaque">
      {ACCENTS.map((accent) => (
        <button
          key={accent.id}
          className="m-swatch"
          aria-label={accent.name}
          aria-pressed={current === accent.id}
          onClick={() => onChange(accent.id)}
        >
          <span style={{ background: accent.color }} />
        </button>
      ))}
    </div>
  </div>
);

/**
 * The same choices as the desktop's Appearance settings: mode, the tone of the mode in use, and the accent.
 *
 * @example <AppearanceCard />
 */
export const AppearanceCard: React.FC = () => {
  const { look, setLook } = useLook();
  const change = (patch: Partial<Appearance>) => setLook({ ...look, ...patch });
  return (
    <section className="m-card">
      <h2>Aparência</h2>
      <Segmented
        label="Modo"
        value={look.mode}
        options={[
          { id: 'light', name: 'Claro' },
          { id: 'dark', name: 'Escuro' },
        ]}
        onChange={(mode) => change({ mode })}
      />
      <ToneChoice look={look} onChange={change} />
      <AccentChoice current={look.accent} onChange={(accent) => change({ accent })} />
    </section>
  );
};
