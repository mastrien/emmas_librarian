import React, { type ReactNode } from 'react';
import { Key } from 'lucide-react';
import { Modal } from '../Modal';
import { ModalFooter } from '../ModalFooter';
import { Button } from '../Button';
import './keyRequired.css';

interface KeyRequiredModalProps {
  title: string;
  /** Why the key is needed, in a sentence. */
  children: ReactNode;
  onCancel: () => void;
  onOpenSettings: () => void;
}

/**
 * Says a feature needs a key the user has not set yet and offers the settings page. One window for the AI key
 * (project page, reader) and the keyed search bases, which were three hand-rolled copies (Arca 134).
 *
 * @example <KeyRequiredModal title="Chave de IA Necessária" onCancel={close} onOpenSettings={goToSettings}>…</KeyRequiredModal>
 */
export const KeyRequiredModal: React.FC<KeyRequiredModalProps> = (props) => (
  <Modal
    label={props.title}
    title={props.title}
    onClose={props.onCancel}
    width={450}
    icon={<Key size={18} aria-hidden="true" />}
    tone="info"
  >
    <p className="key-required-text">{props.children}</p>
    <ModalFooter>
      <Button variant="ghost" onClick={props.onCancel}>
        Cancelar
      </Button>
      <Button variant="primary" onClick={props.onOpenSettings}>
        Configurações
      </Button>
    </ModalFooter>
  </Modal>
);

/** The AI-key text, shared by the project page and the reader. */
export const AI_KEY_TITLE = 'Chave de IA Necessária';
export const AI_KEY_TEXT =
  'Para usar os recursos de Inteligência Artificial, você precisa primeiro configurar sua chave de API ' +
  '(OpenAI, Gemini, Anthropic ou modelo local) nas configurações do sistema.';
