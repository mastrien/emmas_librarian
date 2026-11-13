import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
import { CHANGELOG_RELEASES, type ChangelogRelease } from './changelog/releases';

interface ChangelogModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

const EYEBROW_STYLE: React.CSSProperties = {
  display: 'block',
  marginBottom: '2px',
  color: 'var(--text-muted)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const LINK_STYLE: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'var(--color-primary-text)',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

/**
 * "What's new" dialog shown after the app is updated (board 181): the current version's notes, and a link that lists
 * every earlier version too. The old "Aviso Importante" about API keys is gone: the board does not have it and it
 * repeated what the key window already says when a task needs one.
 *
 * Usage:
 *   <ChangelogModal isOpen={showChangelog} version={appVersion} onClose={dismiss} />
 */
export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, version, onClose }) => {
  const [showAll, setShowAll] = useState(false);
  if (!isOpen) return null;
  const releases = showAll ? CHANGELOG_RELEASES : CHANGELOG_RELEASES.slice(0, 1);

  return (
    <Modal
      label={`Novidades da Versão ${version}`}
      title={
        <>
          <span aria-hidden="true" style={EYEBROW_STYLE}>
            Novidades
          </span>
          {`Versão ${version}`}
        </>
      }
      onClose={onClose}
      width={550}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {releases.map((release) => (
          <ReleaseNotes key={release.title} release={release} showTitle={showAll} />
        ))}
        {!showAll && (
          <button type="button" style={LINK_STYLE} onClick={() => setShowAll(true)}>
            Ver todas as versões
          </button>
        )}
      </div>

      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Continuar
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const ReleaseNotes: React.FC<{ release: ChangelogRelease; showTitle: boolean }> = ({ release, showTitle }) => (
  <div>
    {showTitle && (
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
    )}
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
