import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateCitation, CitationStyle, CitationOutputFormat } from '../services/citationService';
import { X, Copy, Check, FileText, Code, Braces, ChevronDown, ChevronUp } from 'lucide-react';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: any;
}

export function CitationModal({ isOpen, onClose, article }: CitationModalProps) {
  const [style, setStyle] = useState<CitationStyle>('abnt');
  const [format, setFormat] = useState<CitationOutputFormat>('html');
  const [citationText, setCitationText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [editableArticle, setEditableArticle] = useState<any>({});

  useEffect(() => {
    if (isOpen && article) {
      setEditableArticle({
        ...article,
        title: article.title || '',
        authors: article.authors || '',
        year: article.year?.toString() || '',
        doi: article.doi || '',
        journal: article.journal || '',
        volume: article.volume || '',
        issue: article.issue || '',
        page: article.page || '',
        url: article.url || '',
        accessed: article.accessed || '' // Format expected: YYYY-MM-DD
      });
      setIsAccordionOpen(false);
    }
  }, [isOpen, article]);

  useEffect(() => {
    if (isOpen && editableArticle.title !== undefined) {
      setCitationText(generateCitation(editableArticle, style, format));
    }
  }, [isOpen, editableArticle, style, format]);

  if (!isOpen || !article) return null;

  const handleCopy = () => {
    const textToCopy = format === 'html' ? citationText.replace(/<[^>]+>/g, '') : citationText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableArticle({
      ...editableArticle,
      [e.target.name]: e.target.value
    });
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={onClose}>
      <div className="card fade-in" onClick={e => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--text-heading)' }}>Gerar Citação</h2>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={onClose}><X size={20} /></button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estilo da Citação:</label>
            <select 
              value={style} 
              onChange={e => setStyle(e.target.value as CitationStyle)}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)', fontFamily: 'inherit' }}
            >
              <option value="abnt">ABNT</option>
              <option value="apa">APA</option>
              <option value="vancouver">Vancouver</option>
              <option value="harvard1">Harvard</option>
              <option value="ieee">IEEE</option>
            </select>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button 
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-surface)', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: 'var(--text-heading)', fontWeight: 600 }}
            >
              Metadados do Artigo (Clique para Editar)
              {isAccordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <div 
              style={{
                maxHeight: isAccordionOpen ? '1000px' : '0',
                opacity: isAccordionOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                background: 'var(--bg-main)'
              }}
            >
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Título</label>
                    <input name="title" value={editableArticle.title || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Autores (separados por ;)</label>
                    <input name="authors" value={editableArticle.authors || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Ano</label>
                    <input name="year" type="number" value={editableArticle.year || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>DOI</label>
                    <input name="doi" value={editableArticle.doi || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Revista / Periódico</label>
                  <input name="journal" value={editableArticle.journal || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Volume</label>
                    <input name="volume" value={editableArticle.volume || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Edição (Issue)</label>
                    <input name="issue" value={editableArticle.issue || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Páginas</label>
                    <input name="page" value={editableArticle.page || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Disponível em (URL)</label>
                    <input name="url" value={editableArticle.url || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Acesso em</label>
                    <input name="accessed" type="date" value={editableArticle.accessed || ''} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button 
                onClick={() => setFormat('html')}
                className={format === 'html' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText size={16} /> Visualização (HTML)
              </button>
              <button 
                onClick={() => setFormat('text')}
                className={format === 'text' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Code size={16} /> Texto Simples
              </button>
              <button 
                onClick={() => setFormat('bibtex')}
                className={format === 'bibtex' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Braces size={16} /> BibTeX / LaTeX
              </button>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div 
                style={{ 
                  padding: '1.5rem 1.5rem 4rem 1.5rem', 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  minHeight: '120px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: format === 'html' ? 'normal' : 'pre-wrap',
                  fontFamily: format === 'html' ? 'inherit' : 'monospace',
                  fontSize: format === 'html' ? '1rem' : '0.9rem',
                  lineHeight: '1.6'
                }}
              >
                {format === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: citationText }} />
                ) : (
                  citationText
                )}
              </div>
              <button 
                onClick={handleCopy}
                className="btn-primary"
                style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
