import React, { useState } from 'react';
import { COLOR_LABELS, HIGHLIGHT_COLORS, overlayFill, type HighlightColor } from '../pdf/highlightColors';

interface HighlightBarProps {
  /** The text that is selected, shown so the person knows what will be marked. */
  text: string;
  onMark: (color: HighlightColor, note: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * What appears over the PDF when a passage is selected: the colours to mark it with, and a note to go with it.
 *
 * @example <HighlightBar text="Anxiety dropped" onMark={mark} onCancel={clear} />
 */
export const HighlightBar: React.FC<HighlightBarProps> = ({ text, onMark, onCancel }) => {
  const [color, setColor] = useState<HighlightColor>('yellow');
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);
  const mark = (chosen: HighlightColor) => {
    setColor(chosen);
    onMark(chosen, note.trim()).catch(() => setFailed(true));
  };
  return (
    <div className="m-highlightbar" role="toolbar" aria-label="Marcar trecho">
      <p className="m-highlightbar__text">{text.length > 90 ? `${text.slice(0, 90)}…` : text}</p>
      <input
        className="m-input"
        aria-label="Nota (opcional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="m-highlightbar__colors">
        {HIGHLIGHT_COLORS.map((name) => (
          <button
            key={name}
            aria-label={`Marcar de ${COLOR_LABELS[name].toLowerCase()}`}
            aria-pressed={name === color}
            onClick={() => mark(name)}
          >
            <span style={{ background: overlayFill(name) }} />
          </button>
        ))}
        <button aria-label="Cancelar" onClick={onCancel}>
          ✕
        </button>
      </div>
      {failed && (
        <p className="m-note m-note--error" role="alert">
          Não foi possível marcar. Tente de novo.
        </p>
      )}
    </div>
  );
};
