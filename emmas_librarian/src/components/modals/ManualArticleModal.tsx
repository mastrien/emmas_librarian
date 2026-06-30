// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Upload, Loader2, Plus } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';

interface ManualArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<import('../../types').Article>, filePath?: string) => Promise<void>;
}

export const ManualArticleModal: React.FC<ManualArticleModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const projectService = useProjectService();
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [journal, setJournal] = useState('');
  const [abstract, setAbstract] = useState('');
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAuthors('');
      setYear('');
      setDoi('');
      setJournal('');
      setAbstract('');
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
    setSubmitting(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          authors: authors.trim(),
          year: year.trim() || undefined,
          doi: doi.trim() || undefined,
          journal: journal.trim() || undefined,
          abstract: abstract.trim() || undefined,
        },
        filePath,
      );
      onClose();
    } catch (err: Error | unknown) {
      let errorMsg = 'Erro desconhecido';
      if (err) {
        if ((err as Error).message) {
          errorMsg = (err as Error).message;
        } else if (typeof err === 'string') {
          errorMsg = err;
        } else if (typeof err === 'object') {
          try {
            errorMsg = (err as { error?: string }).error || JSON.stringify(err);
          } catch {
            errorMsg = String(err);
          }
        } else {
          errorMsg = String(err);
        }
      }
      alert(`Erro ao adicionar artigo: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
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
          width: '550px',
          maxWidth: '95%',
          maxHeight: '90vh',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '2rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}
          >
            <h3 style={{ margin: 0 }}>Adicionar Artigo Avulso</h3>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <XIcon size={20} />
            </button>
          </div>

          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.85rem',
              color: 'var(--color-danger)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span>⚠️</span>
            <span>
              <strong>Atenção:</strong> Artigos adicionados de forma avulsa podem conter metadados incorretos ou
              incompletos.
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.3rem',
                  color: 'var(--text-muted)',
                }}
              >
                Título *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: A New Approach to Bibliometrics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.3rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Autores
                </label>
                <input
                  type="text"
                  placeholder="Ex: John Doe, Jane Smith"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                  }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                    lineHeight: '1.2',
                  }}
                >
                  Use ponto e vírgula (;) ou vírgula (,) para separar múltiplos autores. Se usar vírgula, use nomes
                  completos (ex: 'João Silva, Maria Souza') para evitar que nomes simples sejam lidos como um único
                  autor.
                </span>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.3rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Ano
                </label>
                <input
                  type="number"
                  placeholder="Ex: 2026"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.3rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  DOI
                </label>
                <input
                  type="text"
                  placeholder="Ex: 10.1000/xyz123"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '0.3rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Revista / Periódico
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nature"
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.3rem',
                  color: 'var(--text-muted)',
                }}
              >
                Resumo
              </label>
              <textarea
                placeholder="Resumo do artigo..."
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  resize: 'none',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.3rem',
                  color: 'var(--text-muted)',
                }}
              >
                Documento PDF (Opcional)
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                >
                  <Upload size={16} /> {filePath ? 'Alterar PDF' : 'Selecionar PDF'}
                </button>
                {filePath && (
                  <div
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                    title={filePath}
                  >
                    {filePath.split('\\').pop()?.split('/').pop()}
                  </div>
                )}
                {filePath && (
                  <button
                    type="button"
                    onClick={() => setFilePath(undefined)}
                    className="btn-secondary"
                    style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
                    title="Remover PDF"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Salvar Artigo
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};
