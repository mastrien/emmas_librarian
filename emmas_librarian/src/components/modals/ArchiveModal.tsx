import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
import { TextField } from '../common/fields';
import './modalForms.css';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  // Multi-select: how many articles the one reason will be saved on (default 1).
  count?: number;
}

const reasonLabel = (
  <>
    Motivo <span className="modal-optional">(opcional)</span>
  </>
);

// Mounted only while open: each archiving starts with an empty reason (it used to keep the last one typed).
const ArchiveForm: React.FC<Omit<ArchiveModalProps, 'isOpen'>> = ({ onClose, onSubmit, count = 1 }) => {
  const [note, setNote] = useState('');
  const many = count > 1;
  return (
    <Modal
      label={many ? `Arquivar ${count} artigos` : 'Arquivar artigo'}
      title={many ? `Arquivar ${count} artigos` : 'Arquivar este artigo?'}
      onClose={onClose}
      width={400}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(note);
        }}
      >
        <p className="modal-form__lead">
          {many
            ? `O motivo (opcional) vale para todos os ${count} artigos e aparece na exportação.`
            : 'Ele sai da lista de ativos e volta quando você quiser.'}
        </p>
        <TextField
          autoFocus
          label={reasonLabel}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ex.: fora do escopo"
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
 * Asks the optional reason for archiving one article, or several at once (the same reason for all). Board 176.
 *
 * @example <ArchiveModal isOpen={archiving} count={2} onClose={close} onSubmit={(note) => archive(note)} />
 */
export const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <ArchiveForm {...props} /> : null;
