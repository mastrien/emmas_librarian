import React, { useState } from 'react';

/** The colours a highlight can have; the reader's bar sets the one a new highlight starts with (board 169). */
export const HIGHLIGHT_COLORS = ['yellow', 'lightgreen', 'lightblue', 'lightpink', 'plum'] as const;

interface TipContentProps {
  position: unknown;
  content: unknown;
  hideTipAndSelection: () => void;
  addHighlight: (highlight: unknown) => void;
  /** The colour chosen on the bar; the popup starts with it. */
  initialColor?: string;
}

export const TipContent: React.FC<TipContentProps> = ({
  position,
  content,
  hideTipAndSelection,
  addHighlight,
  initialColor = 'yellow',
}) => {
  const [color, setColor] = useState(initialColor);
  const [text, setText] = useState('');

  return (
    <div
      className="card fade-in"
      style={{
        padding: '1rem',
        width: '240px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'center' }}>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: color === c ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: c,
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
      <textarea
        placeholder="Adicionar nota (opcional)..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          width: '100%',
          height: '70px',
          marginBottom: '0.75rem',
          display: 'block',
          padding: '0.6rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          fontSize: '0.85rem',
          outline: 'none',
          resize: 'none',
          transition: 'border-color var(--transition-fast)',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => {
            addHighlight({ content, position, comment: { text }, color });
            hideTipAndSelection();
          }}
          className="btn-primary"
          style={{ flexGrow: 1, padding: '0.5rem', fontSize: '0.85rem' }}
        >
          Destacar
        </button>
        <button
          onClick={hideTipAndSelection}
          className="btn-secondary"
          style={{ padding: '0.5rem', fontSize: '0.85rem' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
