import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { CHANGELOG_RELEASES, type ChangelogRelease } from './changelog/releases';

interface ChangelogModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

/**
 * "What's new" dialog shown after the app is updated.
 *
 * Usage:
 *   <ChangelogModal isOpen={showChangelog} version={appVersion} onClose={dismiss} />
 */
export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, version, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: '550px',
          maxWidth: '95%',
          maxHeight: '90vh',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles className="text-primary" size={24} color="var(--color-primary)" />
                Novidades da Versão {version}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Veja o que mudou no Emma's Librarian.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {CHANGELOG_RELEASES.map((release) => (
              <ReleaseNotes key={release.title} release={release} />
            ))}
            <ApiKeyReminder />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-primary">
              Entendido, vamos lá!
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const ReleaseNotes: React.FC<{ release: ChangelogRelease }> = ({ release }) => (
  <div>
    <h3
      style={{
        marginTop: 0,
        marginBottom: '0.75rem',
        fontSize: '1.1rem',
        color: 'var(--color-primary)',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.25rem',
      }}
    >
      {release.title}
    </h3>
    <ul
      style={{
        margin: 0,
        paddingLeft: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        color: 'var(--text-main)',
        fontSize: '0.95rem',
      }}
    >
      {release.items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  </div>
);

const ApiKeyReminder: React.FC = () => (
  <div
    style={{
      padding: '1rem',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      display: 'flex',
      gap: '1rem',
      alignItems: 'flex-start',
    }}
  >
    <AlertCircle size={20} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
    <div>
      <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Aviso Importante</p>
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        Certifique-se de configurar suas chaves de API nas configurações se deseja continuar usando os resumos de IA e busca
        avançada.
      </p>
    </div>
  </div>
);
