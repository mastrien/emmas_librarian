import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Motivo do Arquivamento (Opcional)</h3>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(note); }}>
          <textarea 
            autoFocus
            value={note} 
            onChange={(e) => setNote(e.target.value)}
            placeholder="Por que este artigo não é relevante?"
            style={{ 
              width: '100%', height: '100px', padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
              outline: 'none', resize: 'none', marginBottom: '1rem',
              fontFamily: 'inherit',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)'
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" style={{ background: 'var(--color-danger)', color: '#ffffff' }}>Confirmar Arquivamento</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
