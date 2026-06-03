import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, AlertCircle } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, version, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '550px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles className="text-primary" size={24} color="var(--color-primary)" /> 
              Novidades da Versão {version}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Veja o que mudou no Emma's Librarian.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-heading)' }}>🚀 Novas Funcionalidades</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-main)' }}>
              <li><strong>Categorias de Seleção Múltipla:</strong> Adicionado suporte a categorias do tipo "seleção múltipla" (multi-select), permitindo selecionar várias opções simultaneamente para classificar cada artigo.</li>
            </ul>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-heading)' }}>🐛 Correções de Bugs e Melhorias</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-main)' }}>
              <li><strong>Melhoria na Ancoragem de Destaques:</strong> Nova normalização de caracteres do PDF (como ligaduras, aspas e travessões) que melhora a vinculação automática com o texto.</li>
              <li><strong>Quebras de Linha nas Anotações:</strong> Suporte completo para renderização de quebras de linha (\n) nos comentários, anotações e no popup de hover no leitor.</li>
              <li><strong>Sincronização do Diário:</strong> Resolução de inconsistências de persistência de dados e condições de corrida no diário do projeto.</li>
              <li><strong>Gerenciamento de Opções:</strong> Substituição do prompt nativo por campos de input dinâmicos na criação de opções para categorias de enum.</li>
            </ul>
          </div>

          <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <AlertCircle size={20} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Aviso Importante</p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Certifique-se de configurar suas chaves de API nas configurações se deseja continuar usando os resumos de IA e busca avançada.</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary">
            Entendido, vamos lá!
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
