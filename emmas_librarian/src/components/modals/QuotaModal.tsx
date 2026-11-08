import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import './quotaModal.css';

interface QuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Says the AI key ran out of quota or credits. One window for the reader and the investigation page, which had
 * their own hand-rolled copies (Arca 134).
 *
 * @example <QuotaModal isOpen={run.quotaHit} onClose={dismiss} />
 */
export const QuotaModal: React.FC<QuotaModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <Modal label="Limite de Cota Atingido" title="Limite de Cota Atingido" onClose={onClose} width={400}>
      <AlertCircle size={48} aria-hidden="true" className="quota-modal-icon" />
      <p className="quota-modal-text">
        A sua chave de API (OpenAI/Anthropic/Gemini) parece ter esgotado o limite de cota ou os créditos disponíveis.
        Verifique o seu provedor de IA e atualize as configurações no sistema.
      </p>
      <Button variant="primary" fill="block" onClick={onClose}>
        Entendi
      </Button>
    </Modal>
  );
};
