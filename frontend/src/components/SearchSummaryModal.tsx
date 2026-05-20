import React from 'react';
import { CheckCircle, Database, LayoutList, X } from 'lucide-react';

interface SearchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: {
    savedCount: number;
    breakdown: Record<string, { count: number; error?: string }>;
  };
}

import { createPortal } from 'react-dom';

export const SearchSummaryModal: React.FC<SearchSummaryModalProps> = ({ isOpen, onClose, summary }) => {
  if (!isOpen) return null;

  const totalFound = Object.values(summary.breakdown).reduce((a, b) => a + b.count, 0);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-surface)', padding: '2.5rem', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--color-success)', color: 'white', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle size={40} />
          </div>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>Busca Concluída!</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>A extração de dados foi finalizada com sucesso.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--bg-main)', padding: '1.2rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Encontrado</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-heading)' }}>{totalFound}</div>
          </div>
          <div style={{ background: 'var(--bg-main)', padding: '1.2rem', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Salvos no Projeto</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{summary.savedCount}</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} /> Resultados por Base
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(summary.breakdown).map(([db, data]) => (
              <div key={db} style={{ padding: '0.8rem 1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: `1px solid ${data.error ? 'var(--color-danger)' : 'var(--border-color)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{db === 'wos' ? 'Web of Science' : db}</span>
                  <span style={{ fontWeight: 700, color: data.error ? 'var(--color-danger)' : 'var(--text-heading)' }}>
                    {data.error ? 'Falha' : data.count}
                  </span>
                </div>
                {data.error && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    {data.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '1rem' }}>
          <LayoutList size={20} /> Ver Artigos do Projeto
        </button>
      </div>
    </div>,
    document.body
  );
};
