import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Loader2, Save, Sparkles } from 'lucide-react';
import { Article } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import { describeError } from '../../utils/describeError';
import type { FrontendAppError } from '../../utils/AppError';
import { LabeledField } from '../common/LabeledField';
import { AUTHORS_SEPARATOR_HINT } from '../common/articleFieldHints';

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
      alert(`Erro ao editar artigo: ${describeError(err)}`);
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
      // Typed, user-actionable errors (e.g. missing API key) get the global error modal.
      const appError = err as Partial<FrontendAppError> | null;
      if (appError?.isAppError && appError.code !== 'ERR_INTERNAL') {
        showError(err);
      } else {
        alert(`Erro ao extrair metadados: ${describeError(err)}`);
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
            <LabeledField label="Título *" value={title} onChange={setTitle} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <LabeledField label="Autores" value={authors} onChange={setAuthors} hint={AUTHORS_SEPARATOR_HINT} />
              <LabeledField label="Ano" type="number" value={year} onChange={setYear} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <LabeledField label="DOI" value={doi} onChange={setDoi} />
              <LabeledField label="Revista / Periódico" value={journal} onChange={setJournal} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <LabeledField label="Volume" value={volume} onChange={setVolume} />
              <LabeledField label="Edição (Issue)" value={issue} onChange={setIssue} />
              <LabeledField label="Páginas" value={pages} onChange={setPages} />
            </div>
            <LabeledField label="Resumo" value={abstract} onChange={setAbstract} multiline />

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
