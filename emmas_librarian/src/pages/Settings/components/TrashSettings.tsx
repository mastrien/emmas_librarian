import React from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import type { TrashItem } from '../../../types';

interface TrashSettingsProps {
  trashItems: TrashItem[];
  handleEmptyTrash: () => void;
  handleRestore: (type: 'project' | 'article' | 'annotation', id: number) => void;
  handlePermanentDelete: (type: 'project' | 'article' | 'annotation', id: number) => void;
}

export const TrashSettings: React.FC<TrashSettingsProps> = ({
  trashItems,
  handleEmptyTrash,
  handleRestore,
  handlePermanentDelete,
}) => {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2
        style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <Trash2 size={24} color="var(--color-danger)" /> Lixeira (Trash Bin)
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Itens excluídos permanecem aqui e podem ser recuperados. Excluir permanentemente removerá os dados e os
        arquivos PDF do disco.
      </p>

      {trashItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
          }}
        >
          A lixeira está vazia.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              onClick={handleEmptyTrash}
              className="btn-danger"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
              }}
            >
              <Trash2 size={16} /> Esvaziar Lixeira
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '0.5rem',
            }}
          >
            {trashItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background:
                          item.type === 'project'
                            ? 'rgba(59, 130, 246, 0.1)'
                            : item.type === 'article'
                              ? 'rgba(16, 185, 129, 0.1)'
                              : 'rgba(245, 158, 11, 0.1)',
                        color:
                          item.type === 'project' ? '#3b82f6' : item.type === 'article' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {item.type === 'project' ? 'Projeto' : item.type === 'article' ? 'Artigo' : 'Anotação'}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Excluído em: {new Date(item.deleted_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleRestore(item.type, item.id)}
                    className="btn-secondary"
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item.type, item.id)}
                    className="btn-danger"
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <X size={14} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
