import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Link as LinkIcon, File as FileIcon, Trash2, Plus, Loader2, Upload } from 'lucide-react';
import { projectService } from '../services/api';
import { ProjectDocument } from '../types';

interface ManageQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  documents: ProjectDocument[];
  onDocumentsChanged: () => void;
}

export const ManageQuickAccessModal: React.FC<ManageQuickAccessModalProps> = ({ isOpen, onClose, projectId, documents, onDocumentsChanged }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setUrl('');
      setFilePath(undefined);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    try {
      const selected = await projectService.openPdfDialog();
      if (selected) {
        setFilePath(selected);
      }
    } catch (err) {
      alert('Erro ao selecionar o arquivo PDF');
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
      await projectService.createProjectDocument(projectId, title.trim(), url.trim() || undefined, filePath);
      setTitle('');
      setUrl('');
      setFilePath(undefined);
      onDocumentsChanged();
    } catch (err: any) {
      alert(`Erro ao adicionar documento: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este documento de acesso rápido?')) {
      try {
        await projectService.deleteProjectDocument(id);
        onDocumentsChanged();
      } catch (err: any) {
        alert(`Erro ao remover documento: ${err.message || err}`);
      }
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '600px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
          <h3 style={{ margin: 0 }}>Gerenciar Acesso Rápido</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
              Nenhum link ou documento cadastrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    {doc.url ? <LinkIcon size={16} color="var(--color-primary)" /> : <FileIcon size={16} color="var(--color-secondary)" />}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.url || (doc.local_file_path ? doc.local_file_path.split('\\').pop()?.split('/').pop() : 'Documento anexado')}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(doc.id)} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.5rem' }}
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexShrink: 0 }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Adicionar Novo</h4>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Nome do Link/Documento *</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Trello do Projeto, Edital CAPES"
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>URL (Escolha apenas um: URL ou PDF)</label>
                <input 
                  type="url" 
                  placeholder="https://"
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={!!filePath}
                  style={{ 
                    width: '100%', padding: '0.6rem 0.8rem', 
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                    outline: 'none', background: filePath ? 'var(--bg-main)' : 'var(--bg-surface)', color: 'var(--text-main)',
                    fontFamily: 'inherit', opacity: filePath ? 0.6 : 1, cursor: filePath ? 'not-allowed' : 'text'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Arquivo PDF (Escolha apenas um)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={handleSelectFile} 
                    className="btn-secondary"
                    disabled={!!url.trim()}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem', opacity: url.trim() ? 0.6 : 1, cursor: url.trim() ? 'not-allowed' : 'pointer' }}
                  >
                    <Upload size={16} /> {filePath ? 'Trocar PDF' : 'Anexar PDF'}
                  </button>
                  {filePath && (
                    <button 
                      type="button" 
                      onClick={() => setFilePath(undefined)} 
                      className="btn-secondary" 
                      style={{ color: 'var(--color-danger)', padding: '0.6rem' }}
                      title="Remover PDF"
                    >
                      <XIcon size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filePath && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                <strong>Arquivo selecionado:</strong> {filePath.split('\\').pop()?.split('/').pop()}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" disabled={submitting || (!url && !filePath)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Adicionar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
