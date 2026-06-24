import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Loader2, Save, Sparkles } from 'lucide-react';
import { Article } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';
import { useGlobalError } from '../../contexts/GlobalErrorContext';

export const EditArticleModal = ({
  isOpen,
  onClose,
  article,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  article: Article;
  onSubmit: (data: Partial<import('../../types').Article>) => Promise<void>;
}) => {
  const projectService = useProjectService();
  const { showError } = useGlobalError();
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [journal, setJournal] = useState('');
  const [volume, setVolume] = useState('');
  const [issue, setIssue] = useState('');
  const [pages, setPages] = useState('');
  const [abstract, setAbstract] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    if (isOpen && article) {
      setTitle(article.title || '');
      setAuthors(article.authors || '');
      setYear(article.year ? article.year.toString() : '');
      setDoi(article.doi || '');
      setJournal(article.journal || '');
      setVolume(article.volume || '');
      setIssue(article.issue || '');
      setPages(article.pages || '');
      setAbstract(article.abstract || '');
      setSubmitting(false);
    }
  }, [isOpen, article]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        authors: authors.trim(),
        year: year.trim() ? parseInt(year.trim()) : undefined,
        doi: doi.trim() || undefined,
        journal: journal.trim() || undefined,
        volume: volume.trim() || undefined,
        issue: issue.trim() || undefined,
        pages: pages.trim() || undefined,
        abstract: abstract.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
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
      alert(`Erro ao editar artigo: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtractWithAI = async () => {
    if (!article.local_file_path) return;
    setIsExtracting(true);
    try {
      const data = await projectService.extractMetadata(article.id);
      if (data) {
        setTitle((prev) => (prev.trim() ? prev : data.title || prev));
        setAuthors((prev) => (prev.trim() ? prev : data.authors || prev));
        setYear((prev) => (prev.trim() ? prev : data.year ? data.year.toString() : prev));
        setDoi((prev) => (prev.trim() ? prev : data.doi || prev));
        setJournal((prev) => (prev.trim() ? prev : data.journal || prev));
        setVolume((prev) => (prev.trim() ? prev : data.volume || prev));
        setIssue((prev) => (prev.trim() ? prev : data.issue || prev));
        setPages((prev) => (prev.trim() ? prev : data.pages || prev));
        setAbstract((prev) => (prev.trim() ? prev : data.abstract || prev));
      }
    } catch (err: unknown) {
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

      if ((err as any)?.isAppError && (err as any)?.code !== 'ERR_INTERNAL') {
        showError(err);
      } else {
        alert(`Erro ao extrair metadados: ${errorMsg}`);
      }
    } finally {
      setIsExtracting(false);
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
            <h3 style={{ margin: 0 }}>Editar Metadados do Artigo</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {article.local_file_path && (
                <button
                  type="button"
                  onClick={handleExtractWithAI}
                  disabled={isExtracting}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                  }}
                >
                  {isExtracting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                  )}
                  Preencher com IA
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XIcon size={20} />
              </button>
            </div>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
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
                  Volume
                </label>
                <input
                  type="text"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
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
                  Edição (Issue)
                </label>
                <input
                  type="text"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
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
                  Páginas
                </label>
                <input
                  type="text"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
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
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                style={{
                  width: '100%',
                  height: '100px',
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
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
};
