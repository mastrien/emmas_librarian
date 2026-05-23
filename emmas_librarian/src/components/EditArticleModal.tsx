import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Loader2, Save } from 'lucide-react';
import { Article } from '../types';

export const EditArticleModal = ({ 
  isOpen, 
  onClose, 
  article, 
  onSubmit 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  article: Article;
  onSubmit: (data: any) => Promise<void>; 
}) => {
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [journal, setJournal] = useState('');
  const [abstract, setAbstract] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && article) {
      setTitle(article.title || '');
      setAuthors(article.authors || '');
      setYear(article.year ? article.year.toString() : '');
      setDoi(article.doi || '');
      setJournal(article.journal || '');
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
        abstract: abstract.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      alert(`Erro ao editar artigo: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '550px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Editar Metadados do Artigo</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Título *</label>
            <input 
              type="text" 
              required
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Autores</label>
              <input 
                type="text" 
                value={authors} 
                onChange={(e) => setAuthors(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Ano</label>
              <input 
                type="number" 
                value={year} 
                onChange={(e) => setYear(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>DOI</label>
              <input 
                type="text" 
                value={doi} 
                onChange={(e) => setDoi(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Revista / Periódico</label>
              <input 
                type="text" 
                value={journal} 
                onChange={(e) => setJournal(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Resumo</label>
            <textarea 
              value={abstract} 
              onChange={(e) => setAbstract(e.target.value)}
              style={{ 
                width: '100%', height: '100px', padding: '0.6rem 0.8rem', 
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                outline: 'none', resize: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
