import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X as XIcon,
  Link as LinkIcon,
  File as FileIcon,
  Trash2,
  Plus,
  Loader2,
  Upload,
  GripVertical,
  Pencil,
  Tag,
  Check,
} from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import { ProjectDocument } from '../../types';

interface ManageQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  documents: ProjectDocument[];
  onDocumentsChanged: () => void;
}

const DropGapIndicator: React.FC = () => (
  <div
    style={{
      height: '4px',
      margin: '0.2rem 0',
      borderRadius: '4px',
      background: 'var(--color-primary)',
      boxShadow: '0 0 8px color-mix(in srgb, var(--color-primary) 70%, transparent)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: '-3px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--color-primary)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: '-3px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--color-primary)',
      }}
    />
  </div>
);

export const ManageQuickAccessModal: React.FC<ManageQuickAccessModalProps> = ({
  isOpen,
  onClose,
  projectId,
  documents,
  onDocumentsChanged,
}) => {
  const projectService = useProjectService();
  const [localDocs, setLocalDocs] = useState<ProjectDocument[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);



  useEffect(() => {
    if (isOpen) {
      setLocalDocs(documents);
      resetForm();
    }
  }, [isOpen, documents]);

  const uniqueCategories = useMemo(() => {
    const categories = documents
      .map((d) => d.category?.trim())
      .filter((c): c is string => Boolean(c && c.length > 0));
    return Array.from(new Set(categories));
  }, [documents]);

  if (!isOpen) return null;

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setUrl('');
    setFilePath(undefined);
    setCategory('');
    setSubmitting(false);
  }

  const handleSelectFile = async () => {
    try {
      const selected = await projectService.openPdfDialog();
      if (selected) {
        setFilePath(selected);
      }
    } catch {
      alert('Erro ao selecionar o arquivo PDF');
    }
  };

  const startEditing = (doc: ProjectDocument) => {
    setEditingId(doc.id);
    setTitle(doc.title);
    setUrl(doc.url || '');
    setFilePath(doc.local_file_path || undefined);
    setCategory(doc.category || '');
  };

  const handleCreateOrUpdate = async () => {
    const trimmedTitle = title.trim();
    // IPC serialization drops trailing undefined args; use null to preserve arg positions
    const trimmedUrl = url.trim() || null;
    const safeFilePath = filePath || null;
    const trimmedCategory = category.trim() || null;

    if (editingId !== null) {
      await projectService.updateProjectDocument(editingId, trimmedTitle, trimmedUrl, safeFilePath, trimmedCategory);
    } else {
      await projectService.createProjectDocument(projectId, trimmedTitle, trimmedUrl, safeFilePath, trimmedCategory);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    if (url.trim() && filePath) {
      alert('Por favor, escolha apenas um: Link (URL) ou Arquivo PDF.');
      return;
    }
    setSubmitting(true);
    try {
      await handleCreateOrUpdate();
      resetForm();
      onDocumentsChanged();
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || String(err);
      alert(`Erro ao salvar documento: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este documento de acesso rápido?')) {
      try {
        await projectService.deleteProjectDocument(id);
        if (editingId === id) {
          resetForm();
        }
        onDocumentsChanged();
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || String(err);
        alert(`Erro ao remover documento: ${errorMsg}`);
      }
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);

  const clearDragState = () => {
    draggedIndexRef.current = null;
    dropIndexRef.current = null;
    setDraggedIndex(null);
    setDropIndex(null);
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    e.stopPropagation();
    draggedIndexRef.current = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
    setDraggedIndex(index);
  };

  const handleDragOverItem = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const targetDropIndex = e.clientY < midpoint ? index : index + 1;

    dropIndexRef.current = targetDropIndex;
    setDropIndex(targetDropIndex);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceStr = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
    const parsedSource = sourceStr !== '' ? parseInt(sourceStr, 10) : NaN;
    const sourceIndex = !isNaN(parsedSource) && parsedSource >= 0 ? parsedSource : (draggedIndexRef.current ?? -1);
    const targetDropIndex = dropIndexRef.current;

    if (
      sourceIndex < 0 ||
      sourceIndex >= localDocs.length ||
      targetDropIndex === null ||
      targetDropIndex < 0 ||
      targetDropIndex > localDocs.length
    ) {
      clearDragState();
      return;
    }

    const finalIndex = sourceIndex < targetDropIndex ? targetDropIndex - 1 : targetDropIndex;

    if (sourceIndex === finalIndex) {
      clearDragState();
      return;
    }

    const updated = [...localDocs];
    const [movedItem] = updated.splice(sourceIndex, 1);
    updated.splice(finalIndex, 0, movedItem);

    setLocalDocs(updated);
    clearDragState();

    const orderedIds = updated.map((d) => d.id);
    try {
      await projectService.reorderProjectDocuments(projectId, orderedIds);
      onDocumentsChanged();
    } catch (err) {
      console.error('Erro ao reordenar documentos:', err);
      setLocalDocs(documents);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    clearDragState();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <div
        className="card fade-in"
        style={{
          padding: '2rem',
          width: '640px',
          maxWidth: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-main)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0 }}>Gerenciar Acesso Rápido</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
          {localDocs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
              Nenhum link ou documento cadastrado.
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
            >
              {localDocs.map((doc, index) => {
                const isDragging = draggedIndex === index;
                const showGapBefore =
                  draggedIndex !== null &&
                  dropIndex === index &&
                  draggedIndex !== index &&
                  draggedIndex !== index - 1;
                const showGapAfter =
                  draggedIndex !== null &&
                  index === localDocs.length - 1 &&
                  dropIndex === localDocs.length &&
                  draggedIndex !== localDocs.length - 1;

                return (
                  <React.Fragment key={doc.id}>
                    {showGapBefore && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dropIndexRef.current = index;
                          setDropIndex(index);
                        }}
                        onDrop={handleDrop}
                        style={{ padding: '0.1rem 0' }}
                      >
                        <DropGapIndicator />
                      </div>
                    )}

                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(index, e)}
                      onDragOver={(e) => handleDragOverItem(index, e)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.65rem 0.75rem',
                        background: isEditing(doc.id, editingId)
                          ? 'color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))'
                          : 'var(--bg-surface)',
                        border: isEditing(doc.id, editingId)
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        opacity: isDragging ? 0.35 : 1,
                        transform: isDragging ? 'scale(0.98)' : 'none',
                        transition: 'opacity 0.15s ease, transform 0.15s ease, border var(--transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                        <span
                          title="Segure para arrastar e reordenar"
                          style={{
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--text-muted)',
                            padding: '0.2rem 0',
                          }}
                        >
                          <GripVertical size={16} />
                        </span>

                        {doc.url ? (
                          <LinkIcon size={16} color="var(--color-primary)" />
                        ) : (
                          <FileIcon size={16} color="var(--color-secondary)" />
                        )}

                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-heading)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {doc.title}
                            </span>
                            {doc.category && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: 'var(--radius-xs, 4px)',
                                  background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                                  color: 'var(--color-primary)',
                                  fontWeight: 500,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                }}
                              >
                                <Tag size={10} />
                                {doc.category}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {doc.url ||
                              (doc.local_file_path
                                ? doc.local_file_path.split('\\').pop()?.split('/').pop()
                                : 'Documento anexado')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <button
                          type="button"
                          onClick={() => startEditing(doc)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isEditing(doc.id, editingId) ? 'var(--color-primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.4rem',
                          }}
                          title="Editar item"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            padding: '0.4rem',
                          }}
                          title="Remover item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {showGapAfter && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dropIndexRef.current = localDocs.length;
                          setDropIndex(localDocs.length);
                        }}
                        onDrop={handleDrop}
                        style={{ padding: '0.1rem 0' }}
                      >
                        <DropGapIndicator />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>
              {editingId !== null ? 'Editar Acesso Rápido' : 'Adicionar Novo'}
            </h4>
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Cancelar Edição
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.8rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '0.2rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Nome do Link/Documento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Trello do Projeto, Edital CAPES"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '0.2rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Grupo / Categoria (Opcional)
                </label>
                <input
                  type="text"
                  list="quick-access-categories"
                  placeholder="Ex: Reuniões, Modelos"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                  }}
                />
                <datalist id="quick-access-categories">
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', alignItems: 'end' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '0.2rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  URL (Escolha apenas um: URL ou PDF)
                </label>
                <input
                  type="url"
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={!!filePath}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: filePath ? 'var(--bg-main)' : 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    opacity: filePath ? 0.6 : 1,
                    cursor: filePath ? 'not-allowed' : 'text',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '0.2rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Arquivo PDF (Escolha apenas um)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectFile}
                    className="btn-secondary"
                    disabled={!!url.trim()}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      opacity: url.trim() ? 0.6 : 1,
                      cursor: url.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Upload size={15} /> {filePath ? 'Trocar PDF' : 'Anexar PDF'}
                  </button>
                  {filePath && (
                    <button
                      type="button"
                      onClick={() => setFilePath(undefined)}
                      className="btn-secondary"
                      style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
                      title="Remover PDF"
                    >
                      <XIcon size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filePath && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-primary)',
                  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <strong>Arquivo selecionado:</strong> {filePath.split('\\').pop()?.split('/').pop()}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.3rem' }}>
              <button
                type="submit"
                disabled={submitting || (!url && !filePath)}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                {submitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : editingId !== null ? (
                  <Check size={15} />
                ) : (
                  <Plus size={15} />
                )}
                {editingId !== null ? 'Salvar Alterações' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};

function isEditing(docId: number, activeId: number | null): boolean {
  return activeId === docId;
}
