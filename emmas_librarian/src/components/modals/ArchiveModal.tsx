import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  // Multi-select: how many articles the one reason will be saved on (default 1).
  count?: number;
}

// Mounted only while open: each archiving starts with an empty reason (it used to keep the last one typed).
const ArchiveForm: React.FC<Omit<ArchiveModalProps, 'isOpen'>> = ({ onClose, onSubmit, count = 1 }) => {
  const [note, setNote] = useState('');
  const many = count > 1;
  return (
    <Modal
      label={many ? `Arquivar ${count} artigos` : 'Arquivar artigo'}
      title={many ? `Arquivar ${count} artigos` : 'Arquivar este artigo?'}
      description={
        many
          ? `O motivo (opcional) vale para todos os ${count} artigos e aparece na exportação.`
          : 'Ele sai da lista de ativos e volta quando você quiser.'
      }
      onClose={onClose}
      width={400}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(note);
        }}
      >
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ex.: fora do escopo"
          aria-label="Motivo (opcional)"
          style={{
            width: '100%',
            height: '100px',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            outline: 'none',
            resize: 'none',
            marginBottom: '1rem',
            fontFamily: 'inherit',
            background: 'var(--bg-surface)',
            color: 'var(--text-main)',
          }}
        />
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {many ? `Arquivar ${count}` : 'Arquivar'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

/**
 * Asks the optional reason for archiving one article, or several at once (the same reason for all).
 *
 * @example <ArchiveModal isOpen={archiving} count={2} onClose={close} onSubmit={(note) => archive(note)} />
 */
export const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <ArchiveForm {...props} /> : null;
