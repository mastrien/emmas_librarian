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
              <li><strong>Gráficos e Estatísticas:</strong> Nova aba de estatísticas e gráficos de resumo no Dashboard.</li>
              <li><strong>Categorização de Artigos:</strong> Sistema flexível para adicionar categorias personalizadas aos seus artigos.</li>
              <li><strong>Exportar/Importar Projetos:</strong> Leve seus projetos para onde quiser com o novo formato `.emmapcarc`.</li>
              <li><strong>Citações Bibliográficas:</strong> Geração automática de referências em ABNT/APA a partir dos seus artigos.</li>
              <li><strong>Guia de Escrita:</strong> Nova seção na barra lateral com dicas de formatação.</li>
              <li><strong>Ordenação Personalizada:</strong> Organize os artigos do projeto por data de adição, mais antigos, ou ordem alfabética.</li>
              <li><strong>Copiar Texto do PDF:</strong> Agora você pode copiar facilmente o texto dos destaques no leitor com o botão direito.</li>
            </ul>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-heading)' }}>🐛 Correções de Bugs</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-main)' }}>
              <li>Correção de crash na renderização de destaques de busca com espaços.</li>
              <li>Fix do Zoom no Leitor de PDF que não atualizava visualmente.</li>
              <li>Preencher com IA agora respeita campos que você já preencheu manualmente.</li>
              <li>Erros de banco de dados ao excluir projetos com anexos foram corrigidos.</li>
              <li>Formatação corrigida no chat de IA para quebras de linha (`\n`).</li>
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
