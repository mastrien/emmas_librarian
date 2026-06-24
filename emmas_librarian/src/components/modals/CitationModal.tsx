// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateCitation, CitationStyle, CitationOutputFormat } from '../../services/citationService';
import { X, Copy, Check, FileText, Code, Braces, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: import('../../types').Article | null;
  onArticleUpdated?: () => void;
}

export function CitationModal({ isOpen, onClose, article, onArticleUpdated }: CitationModalProps) {
  const projectService = useProjectService();
  const [style, setStyle] = useState<CitationStyle>('abnt');
  const [format, setFormat] = useState<CitationOutputFormat>('html');
  const [citationText, setCitationText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [editableArticle, setEditableArticle] = useState<
    Partial<import('../../types').Article> & { accessed?: string }
  >({});
  const [saving, setSaving] = useState(false);
  const [useEtAl, setUseEtAl] = useState(true);

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
        page: article.pages || article.pages || '',
        url: article.url || '',
        accessed: article.accessed || '', // Format expected: YYYY-MM-DD
      });
      setIsAccordionOpen(false);
      setUseEtAl(true);
    }
  }, [isOpen, article]);

  useEffect(() => {
    if (isOpen && editableArticle.title !== undefined) {
      setCitationText(generateCitation(editableArticle, style, format, useEtAl));
    }
  }, [isOpen, editableArticle, style, format, useEtAl]);

  if (!isOpen || !article) return null;

  const handleCopy = async () => {
    const plainText = format === 'html' ? citationText.replace(/<[^>]+>/g, '') : citationText;
    if (format === 'html') {
      try {
        const htmlBlob = new Blob([citationText], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);
      } catch (err) {
        console.error('Failed to copy rich text, falling back to plain text:', err);
        await navigator.clipboard.writeText(plainText);
      }
    } else {
      await navigator.clipboard.writeText(plainText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectService.updateArticleMetadata(article.id, {
        title: editableArticle.title,
        authors: editableArticle.authors,
        year: editableArticle.year ? parseInt(editableArticle.year) : undefined,
        doi: editableArticle.doi,
        journal: editableArticle.journal,
        volume: editableArticle.volume,
        issue: editableArticle.issue,
        pages: editableArticle.pages || editableArticle.pagess,
        url: editableArticle.url,
        accessed: editableArticle.accessed,
      });
      if (onArticleUpdated) {
        onArticleUpdated();
      }
      alert('Metadados salvos com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar metadados:', err);
      alert('Erro ao salvar metadados.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (article.csl_json) {
      try {
        const csl = typeof article.csl_json === 'string' ? JSON.parse(article.csl_json) : article.csl_json;

        let authorsString = '';
        if (csl.author && Array.isArray(csl.author)) {
          authorsString = csl.author
            .map((auth: { family?: string; given?: string; literal?: string }) => {
              if (auth.family && auth.given) {
                return `${auth.given} ${auth.family}`;
              }
              return auth.literal || auth.family || auth.given || '';
            })
            .filter(Boolean)
            .join('; ');
        }

        let yearString = '';
        if (csl.issued && csl.issued['date-parts'] && csl.issued['date-parts'][0]) {
          yearString = csl.issued['date-parts'][0][0]?.toString() || '';
        }

        setEditableArticle({
          ...editableArticle,
          title: csl.title || '',
          authors: authorsString,
          year: yearString,
          doi: csl.DOI || '',
          journal: csl['container-title'] || '',
          volume: csl.volume || '',
          issue: csl.issue || '',
          page: csl.pages || '',
          url: csl.URL || '',
          accessed: '',
        });
        return;
      } catch (err) {
        console.error('Failed to parse csl_json for reset', err);
      }
    }

    // Fallback to database values
    setEditableArticle({
      ...article,
      title: article.title || '',
      authors: article.authors || '',
      year: article.year?.toString() || '',
      doi: article.doi || '',
      journal: article.journal || '',
      volume: article.volume || '',
      issue: article.issue || '',
      page: article.pages || article.pages || '',
      url: article.url || '',
      accessed: article.accessed || '',
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableArticle({
      ...editableArticle,
      [e.target.name]: e.target.value,
    });
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
      onClick={onClose}
    >
      <div
        className="card fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '2rem',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--text-heading)' }}>Gerar Citação</h2>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estilo da Citação:</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as CitationStyle)}
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
              >
                <option value="abnt">ABNT</option>
                <option value="apa">APA</option>
                <option value="vancouver">Vancouver</option>
                <option value="harvard1">Harvard</option>
                <option value="ieee">IEEE</option>
              </select>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
              }}
            >
              <input
                type="checkbox"
                checked={useEtAl}
                onChange={(e) => setUseEtAl(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Usar "et al." para múltiplos autores
            </label>
          </div>

          <div
            style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
          >
            <button
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'var(--bg-surface)',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                color: 'var(--text-heading)',
                fontWeight: 600,
              }}
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
                background: 'var(--bg-main)',
              }}
            >
              <div
                style={{
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
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
                      value={editableArticle.title || ''}
                      onChange={handleChange}
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
                      value={editableArticle.authors || ''}
                      onChange={handleChange}
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
                      value={editableArticle.year || ''}
                      onChange={handleChange}
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
                      value={editableArticle.doi || ''}
                      onChange={handleChange}
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
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      marginBottom: '0.3rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Revista / Periódico
                  </label>
                  <input
                    name="journal"
                    value={editableArticle.journal || ''}
                    onChange={handleChange}
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
                      value={editableArticle.volume || ''}
                      onChange={handleChange}
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
                      value={editableArticle.issue || ''}
                      onChange={handleChange}
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
                      name="page"
                      value={editableArticle.pages || ''}
                      onChange={handleChange}
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
                      value={editableArticle.url || ''}
                      onChange={handleChange}
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
                      value={editableArticle.accessed || ''}
                      onChange={handleChange}
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
                    onClick={handleReset}
                    className="btn-secondary"
                    style={{
                      padding: '0.4rem 0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <RotateCcw size={14} /> Resetar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary"
                    style={{
                      padding: '0.4rem 0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Metadados'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.5rem',
              }}
            >
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
                  lineHeight: '1.6',
                }}
              >
                {format === 'html' ? <div dangerouslySetInnerHTML={{ __html: citationText }} /> : citationText}
              </div>
              <button
                onClick={handleCopy}
                className="btn-primary"
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
