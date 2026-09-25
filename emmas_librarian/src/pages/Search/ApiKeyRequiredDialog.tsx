import React from 'react';
import { createPortal } from 'react-dom';
import { Key } from 'lucide-react';

interface ApiKeyRequiredDialogProps {
  database: string;
  onCancel: () => void;
  onOpenSettings: () => void;
}

/**
 * Explains that Scopus / Web of Science need an API key and links to the settings page.
 *
 * Usage:
 *   {missingKeyDb && <ApiKeyRequiredDialog database="wos" onCancel={close} onOpenSettings={() => navigate('/settings')} />}
 */
export const ApiKeyRequiredDialog: React.FC<ApiKeyRequiredDialogProps> = ({ database, onCancel, onOpenSettings }) =>
  createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: '100%',
          maxWidth: '450px',
          background: 'var(--bg-surface)',
          padding: '2.5rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            color: 'var(--color-primary)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <Key size={32} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Chave de API Necessária</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
          Para realizar buscas na <strong>{database === 'wos' ? 'Web of Science' : 'Scopus'}</strong>, você precisa
          primeiro configurar sua chave de API nas configurações do sistema.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button onClick={onOpenSettings} className="btn-primary" style={{ flex: 1 }}>
            Configurações
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
