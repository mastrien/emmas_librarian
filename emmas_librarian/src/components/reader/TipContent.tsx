import React, { useState } from 'react';

interface TipContentProps {
  position: any;
  content: any;
  hideTipAndSelection: () => void;
  addHighlight: (highlight: any) => void;
}

export const TipContent: React.FC<TipContentProps> = ({
  position,
  content,
  hideTipAndSelection,
  addHighlight,
}) => {
  const [color, setColor] = useState('yellow');
  const [text, setText] = useState('');

  return (
    <div className="card fade-in" style={{ 
      padding: '1rem', 
      width: '240px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)'
    }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'center' }}>
        {['yellow', 'lightgreen', 'lightblue', 'lightpink', 'plum'].map(c => (
          <button 
            key={c}
            onClick={() => setColor(c)}
            style={{ 
              width: '24px', height: '24px', borderRadius: '50%', border: color === c ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: c, cursor: 'pointer', padding: 0
            }}
          />
        ))}
      </div>
      <textarea 
        placeholder="Adicionar nota (opcional)..." 
        value={text}
        onChange={e => setText(e.target.value)}
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
          transition: 'border-color var(--transition-fast)'
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
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
