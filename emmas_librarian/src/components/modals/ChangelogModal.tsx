import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
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

  return (
    <Modal
      label={`Novidades da Versão ${version}`}
      title={`Versão ${version}`}
      description="Novidades: o que mudou no Emma's Librarian."
      onClose={onClose}
      width={550}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {CHANGELOG_RELEASES.map((release) => (
          <ReleaseNotes key={release.title} release={release} />
        ))}
        <ApiKeyReminder />
      </div>

      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Continuar
        </Button>
      </ModalFooter>
    </Modal>
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
        Certifique-se de configurar suas chaves de API nas configurações se deseja continuar usando os resumos de IA e
        busca avançada.
      </p>
    </div>
  </div>
);
