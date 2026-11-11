import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../Modal';
import { buildPaletteCommands, filterPaletteCommands, type PaletteCommand } from './paletteCommands';
import { usePaletteSources } from './usePaletteSources';
import { useRegisteredCommands } from './PageCommandsContext';
import './palette.css';

const LISTBOX_ID = 'command-palette-results';
const optionId = (command: PaletteCommand) => `palette-${command.id.replace(/[^a-z0-9-]/gi, '-')}`;

interface PaletteResultsProps {
  results: PaletteCommand[];
  activeIndex: number;
  onPick: (command: PaletteCommand) => void;
  onHover: (index: number) => void;
}

const PaletteResults: React.FC<PaletteResultsProps> = ({ results, activeIndex, onPick, onHover }) => (
  <ul id={LISTBOX_ID} role="listbox" aria-label="Resultados" className="palette-results">
    {results.map((command, index) => (
      <React.Fragment key={command.id}>
        {/* A group heading wherever the group changes; ranking may bring a group back further down. */}
        {command.group !== results[index - 1]?.group && (
          <li role="presentation" className="palette-group">
            {command.group}
          </li>
        )}
        <li
          id={optionId(command)}
          role="option"
          aria-selected={index === activeIndex}
          className="palette-option"
          onMouseMove={() => onHover(index)}
          onClick={() => onPick(command)}
        >
          <span className="palette-option__label">{command.label}</span>
          {command.hint && <span className="palette-option__hint">{command.hint}</span>}
        </li>
      </React.Fragment>
    ))}
  </ul>
);

const nextIndex = (key: string, index: number, count: number): number | null => {
  if (count === 0) return null;
  if (key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowUp') return (index - 1 + count) % count;
  return null;
};

/**
 * The Ctrl+K palette: type to go to a place, a project or an article of the current project, or to start a
 * common action; arrows choose, Enter goes, Esc closes. Mount it only while open.
 *
 * @example {isOpen && <CommandPalette currentProjectId={3} onClose={() => setOpen(false)} />}
 */
export const CommandPalette: React.FC<{ currentProjectId?: number; onClose: () => void }> = (props) => {
  const navigate = useNavigate();
  const sources = usePaletteSources(props.currentProjectId);
  const screenCommands = useRegisteredCommands();
  const commands = useMemo(() => buildPaletteCommands(sources, screenCommands), [sources, screenCommands]);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => filterPaletteCommands(commands, query), [commands, query]);
  const active = results[Math.min(activeIndex, results.length - 1)];

  const pick = (command: PaletteCommand) => {
    props.onClose();
    if (command.run) command.run();
    else if (command.to) navigate(command.to);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const next = nextIndex(event.key, activeIndex, results.length);
    if (next !== null) setActiveIndex(next);
    if (event.key === 'Enter' && active) pick(active);
    if (next !== null || event.key === 'Enter') event.preventDefault();
  };

  return (
    <Modal label="Ir para" title="Ir para" onClose={props.onClose} width={560} className="palette">
      <input
        autoFocus
        className="palette-input"
        role="combobox"
        aria-expanded="true"
        aria-controls={LISTBOX_ID}
        aria-activedescendant={active ? optionId(active) : undefined}
        aria-label="Ir para, buscar artigo, executar"
        placeholder="Ir para, buscar artigo, executar…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
      />
      {results.length === 0 ? (
        <p className="palette-empty">Nada encontrado para “{query}”.</p>
      ) : (
        <PaletteResults results={results} activeIndex={activeIndex} onPick={pick} onHover={setActiveIndex} />
      )}
    </Modal>
  );
};
