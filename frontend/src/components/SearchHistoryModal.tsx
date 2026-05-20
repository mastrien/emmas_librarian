import React from 'react';
import { X, Calendar, Search, Database, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

interface HistoryItem {
  id: number;
  unified_query: string;
  translated_queries: string;
  total_results: number;
  results_breakdown: string;
  created_at: string;
}

export const SearchHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; history: HistoryItem[] }> = ({ isOpen, onClose, history }) => {
  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="card fade-in" style={{ width: '90%', maxWidth: '900px', maxHeight: '85vh', background: 'var(--bg-surface)', padding: '2.5rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={24} />
        </button>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RotateCcw size={28} /> Histórico de Buscas
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Registro de todas as buscas realizadas neste projeto.</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
          {history.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma busca registrada ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {history.map(item => {
                const breakdown = JSON.parse(item.results_breakdown);
                const translated = JSON.parse(item.translated_queries);
                
                return (
                  <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', background: 'var(--bg-main)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <Calendar size={14} /> {new Date(item.created_at).toLocaleString()}
                      </div>
                      <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.2rem 0.75rem', borderRadius: 'var(--radius-xl)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {item.total_results} artigos salvos
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Search size={16} /> Query Unificada
                      </div>
                      <div style={{ padding: '0.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontStyle: 'italic', color: 'var(--text-main)' }}>
                        {item.unified_query}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Database size={14} /> Resultados por Base
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {Object.entries(breakdown).map(([db, data]: [string, any]) => (
                            <div key={db} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: `1px solid ${data.error ? 'var(--color-danger)' : 'var(--border-color)'}` }}>
                              <span style={{ textTransform: 'capitalize' }}>{db === 'wos' ? 'Web of Science' : db}</span>: <strong>{data.error ? 'Falha' : data.count}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ChevronRight size={14} /> Queries Traduzidas
                        </div>
                        <details style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                          <summary style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Ver detalhes da tradução</summary>
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {Object.entries(translated).map(([db, q]) => (
                              <div key={db} style={{ padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                <strong style={{ textTransform: 'capitalize' }}>{db}:</strong> {q as any}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

import { RotateCcw } from 'lucide-react'; // Fix missing import if needed, but it was already used
