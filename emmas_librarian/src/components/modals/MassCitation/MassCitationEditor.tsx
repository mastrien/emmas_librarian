import React from 'react';
import { Save, Edit3, RotateCcw } from 'lucide-react';

interface MassCitationEditorProps {
  editableFields: any;
  handleFieldChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  saving: boolean;
  handleSaveEdit: () => void;
  handleResetEdit: () => void;
  setEditingArticle: (val: any) => void;
}

export function MassCitationEditor({
  editableFields,
  handleFieldChange,
  saving,
  handleSaveEdit,
  handleResetEdit,
  setEditingArticle,
}: MassCitationEditorProps) {
  return (
    <>

            /* Individual editing panel */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                background: 'var(--bg-surface)',
                marginBottom: '1.5rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)' }}>
                Editar Metadados da Citação
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Título
                  </label>
                  <input
                    name="title"
                    value={editableFields.title || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Autores (separados por ; ou ,)
                  </label>
                  <input
                    name="authors"
                    value={editableFields.authors || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.25rem',
                      lineHeight: '1.2',
                    }}
                  >
                    Se usar vírgula, use nomes completos (ex: 'João Silva, Maria Souza') para evitar que nomes simples
                    sejam lidos como um único autor.
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Ano
                  </label>
                  <input
                    name="year"
                    type="number"
                    value={editableFields.year || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    DOI
                  </label>
                  <input
                    name="doi"
                    value={editableFields.doi || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}
                >
                  Revista / Periódico
                </label>
                <input
                  name="journal"
                  value={editableFields.journal || ''}
                  onChange={handleFieldChange}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Volume
                  </label>
                  <input
                    name="volume"
                    value={editableFields.volume || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Edição (Issue)
                  </label>
                  <input
                    name="issue"
                    value={editableFields.issue || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Páginas
                  </label>
                  <input
                    name="pages"
                    value={editableFields.pages || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Disponível em (URL)
                  </label>
                  <input
                    name="url"
                    value={editableFields.url || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Acesso em
                  </label>
                  <input
                    name="accessed"
                    type="date"
                    value={editableFields.accessed || ''}
                    onChange={handleFieldChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetEdit}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RotateCcw size={14} /> Resetar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>

    </>
  );
}
