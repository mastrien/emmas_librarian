import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';

interface QuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuotaModal: React.FC<QuotaModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
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
        style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)', textAlign: 'center' }}
      >
        <AlertCircle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem auto' }} />
        <h3 style={{ margin: '0 0 1rem 0' }}>Limite de Cota Atingido</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>
          A sua chave de API (OpenAI/Anthropic/Gemini) parece ter esgotado o limite de cota ou os créditos disponíveis.
          Verifique o seu provedor de IA e atualize as configurações no sistema.
        </p>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  );
};
