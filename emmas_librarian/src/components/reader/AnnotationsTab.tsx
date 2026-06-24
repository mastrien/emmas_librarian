import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';

import { Annotation } from '../../types';

interface AnnotationsTabProps {
  highlights: unknown[];
  standaloneAnnotations: Annotation[];
  newAnnotationText: string;
  setNewAnnotationText: (val: string) => void;
  editingId: string | null;
  setEditingId: (val: string | null) => void;
  editContent: string;
  setEditContent: (val: string) => void;
  onCreateStandaloneAnnotation: () => void;
  onDeleteHighlight: (highlightId: string, e: React.MouseEvent) => void;
  onDeleteStandaloneAnnotation: (annId: string) => void;
  onEditHighlightAnnotation: (h: unknown, e: React.MouseEvent) => void;
  onEditStandaloneAnnotation: (a: Annotation) => void;
  onSaveEdit: (idToSave: string, annotationId: number, isStandalone: boolean) => void;
  onHighlightClick: (h: unknown) => void;
}

export const AnnotationsTab: React.FC<AnnotationsTabProps> = ({
  highlights,
  standaloneAnnotations,
  newAnnotationText,
  setNewAnnotationText,
  editingId,
  setEditingId,
  editContent,
  setEditContent,
  onCreateStandaloneAnnotation,
  onDeleteHighlight,
  onDeleteStandaloneAnnotation,
  onEditHighlightAnnotation,
  onEditStandaloneAnnotation,
  onSaveEdit,
  onHighlightClick,
}) => {
  return (
    <>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)', marginBottom: '1rem' }}>
          Anotações ({highlights.length + standaloneAnnotations.length})
        </h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
          <textarea 
            value={newAnnotationText}
            onChange={(e) => setNewAnnotationText(e.target.value)}
            placeholder="Nova anotação avulsa..." 
            style={{ 
              width: '100%', 
              height: '60px', 
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none',
              resize: 'none'
            }}
          />
          <button 
            onClick={onCreateStandaloneAnnotation}
            className="btn-primary"
            disabled={!newAnnotationText.trim()}
            style={{ fontSize: '0.85rem', padding: '0.4rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {highlights.length === 0 && standaloneAnnotations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
            Nenhuma anotação ou destaque ainda.
          </p>
        ) : (
          <>
            {standaloneAnnotations.map((a, idx) => (
              <div key={`ann-${a.id || idx}`} className="card hover-lift" style={{ 
                padding: '1rem', 
                border: '1px solid var(--border-color)', 
                background: 'var(--bg-main)',
                fontSize: '0.9rem',
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onEditStandaloneAnnotation(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onDeleteStandaloneAnnotation(a.id.toString())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ color: 'var(--text-heading)', fontWeight: 500, paddingRight: '2rem' }}>
                  {editingId === a.id.toString() ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                          setEditContent(e.target.value);
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%', minHeight: '60px', padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                          background: 'var(--bg-main)', color: 'var(--text-main)',
                          fontSize: '0.85rem', outline: 'none', resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => onSaveEdit(a.id.toString(), a.id, true)} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Salvar</button>
                        <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.content_markdown}</span>
                  )}
                </div>
              </div>
            ))}

            {highlights.map((hRaw, idx) => {
              const h = hRaw as { id: string; position?: { pageNumber?: number; boundingRect?: { pageNumber?: number } }; content?: { text: string }; comment?: { text: string }; annotation_id?: number };
              const pageNum = h.position?.boundingRect?.pageNumber || h.position?.pageNumber;
              return (
                <div 
                  key={`high-${h.id || idx}`} 
                  className="card hover-lift" 
                  onClick={() => onHighlightClick(h)}
                  style={{ 
                    padding: '1rem', 
                    border: '1px solid var(--border-color)', 
                    background: 'var(--bg-main)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    {h.annotation_id && (
                      <button onClick={(e) => onEditHighlightAnnotation(h, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Editar">
                        <Edit2 size={14} />
                      </button>
                    )}
                    <button onClick={(e) => onDeleteHighlight(h.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  {pageNum && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                      Página {pageNum}
                    </div>
                  )}
                  <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', paddingRight: '2.5rem' }}>
                    "{h.content?.text?.substring(0, 80)}{(h.content?.text?.length ?? 0) > 80 ? '...' : ''}"
                  </div>
                  {editingId === h.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                      <textarea
                        value={editContent}
                        onChange={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                          setEditContent(e.target.value);
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }
                        }}
                        style={{
                          width: '100%', minHeight: '60px', padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                          background: 'var(--bg-main)', color: 'var(--text-main)',
                          fontSize: '0.85rem', outline: 'none', resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={(e) => { e.stopPropagation(); onSaveEdit(h.id, h.annotation_id!, false); }} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Salvar</button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    h.comment?.text && (
                      <div style={{ color: 'var(--text-heading)', fontWeight: 500 }}>
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{h.comment.text}</span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
};
