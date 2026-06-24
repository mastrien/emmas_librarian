// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateCitation, parseAuthors, CitationStyle, CitationOutputFormat } from '../../services/citationService';
import { X, Copy, Check, FileText, Code, Braces, Save, RotateCcw, Edit3 } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import { Article } from '../../types';

interface MassCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  onArticlesUpdated?: () => void;
}

export function MassCitationModal({ isOpen, onClose, articles, onArticlesUpdated }: MassCitationModalProps) {
  const projectService = useProjectService();
  const [style, setStyle] = useState<CitationStyle>('abnt');
  const [format, setFormat] = useState<CitationOutputFormat>('html');
  const [sortBy, setSortBy] = useState<'author' | 'year'>('author');
  
  const [localArticles, setLocalArticles] = useState<import("../../types").Article[]>([]);
  const [initialArticles, setInitialArticles] = useState<import("../../types").Article[]>([]);
  const [editingArticle, setEditingArticle] = useState<import("../../types").Article | null>(null);
  const [editableFields, setEditableFields] = useState<Partial<import("../../types").Article> & { accessed?: string }>({});
  
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useEtAl, setUseEtAl] = useState(true);

  useEffect(() => {
    if (isOpen && articles) {
      const formatted = articles.map(art => ({
        ...art,
        title: art.title || '',
        authors: art.authors || '',
        year: art.year?.toString() || '',
        doi: art.doi || '',
        journal: art.journal || '',
        volume: art.volume || '',
        issue: art.issue || '',
        pages: art.pages || '',
        url: art.url || '',
        accessed: art.accessed || ''
      }));
      setLocalArticles(formatted);
      setInitialArticles(JSON.parse(JSON.stringify(formatted)));
      setEditingArticle(null);
      setUseEtAl(true);
    }
  }, [isOpen, articles]);

  if (!isOpen) return null;

  const getFirstAuthorLastName = (authorsStr: string) => {
    if (!authorsStr) return '';
    const parsed = parseAuthors(authorsStr);
    if (parsed.length === 0) return '';
    const first = parsed[0];
    // Use the family (surname) field; fall back to literal if unavailable
    return first.family || first.literal || '';
  };

  const getSortedArticles = () => {
    return [...localArticles].sort((a, b) => {
      if (sortBy === 'author') {
        const authorA = getFirstAuthorLastName(a.authors);
        const authorB = getFirstAuthorLastName(b.authors);
        return authorA.localeCompare(authorB, 'pt-BR');
      } else {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        return yearA - yearB;
      }
    });
  };

  const sortedArticles = getSortedArticles();

  const handleCopyAll = async () => {
    if (sortedArticles.length === 0) return;

    const citationTexts = sortedArticles.map(art => generateCitation(art, style, format, useEtAl));

    if (format === 'html') {
      const mergedHtml = citationTexts.join('<br/><br/>');
      const plainText = citationTexts
        .map(txt => txt.replace(/<[^>]+>/g, ''))
        .join('\n\n');

      try {
        const htmlBlob = new Blob([mergedHtml], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);
      } catch (err) {
        console.error('Failed to copy rich text in bulk, falling back to plain text:', err);
        await navigator.clipboard.writeText(plainText);
      }
    } else {
      const mergedText = citationTexts.join('\n\n');
      await navigator.clipboard.writeText(mergedText);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = (art: import("../../types").Article) => {
    setEditingArticle(art);
    setEditableFields({ ...art });
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableFields({
      ...editableFields,
      [e.target.name]: e.target.value
    });
  };

  const handleSaveEdit = async () => {
    if (!editingArticle) return;
    setSaving(true);
    try {
      await projectService.updateArticleMetadata(editingArticle.id, {
        title: editableFields.title,
        authors: editableFields.authors,
        year: editableFields.year ? Number(editableFields.year) : undefined,
        doi: editableFields.doi,
        journal: editableFields.journal,
        volume: editableFields.volume,
        issue: editableFields.issue,
        pages: editableFields.pages,
        url: editableFields.url,
        accessed: editableFields.accessed
      });

      // Update state in memory
      setLocalArticles(prev => prev.map(art => {
        if (art.id === editingArticle.id) {
          return { ...art, ...editableFields } as import("../../types").Article;
        }
        return art;
      }));

      if (onArticlesUpdated) {
        onArticlesUpdated();
      }

      setEditingArticle(null);
    } catch (err) {
      console.error('Erro ao salvar metadados em lote:', err);
      alert('Erro ao salvar metadados.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetEdit = () => {
    if (!editingArticle) return;
    
    if (editingArticle.csl_json) {
      try {
        const csl = typeof editingArticle.csl_json === 'string' ? JSON.parse(editingArticle.csl_json) : editingArticle.csl_json;
        
        let authorsString = '';
        if (csl.author && Array.isArray(csl.author)) {
          authorsString = csl.author.map((auth: { family?: string; given?: string; literal?: string }) => {
            if (auth.family && auth.given) {
              return `${auth.given} ${auth.family}`;
            }
            return auth.literal || auth.family || auth.given || '';
          }).filter(Boolean).join('; ');
        }
        
        let yearString = '';
        if (csl.issued && csl.issued['date-parts'] && csl.issued['date-parts'][0]) {
          yearString = csl.issued['date-parts'][0][0]?.toString() || '';
        }

        setEditableFields({
          ...editableFields,
          title: csl.title || '',
          authors: authorsString,
          year: yearString,
          doi: csl.DOI || '',
          journal: csl['container-title'] || '',
          volume: csl.volume || '',
          issue: csl.issue || '',
          pages: csl.page || '',
          url: csl.URL || '',
          accessed: ''
        });
        return;
      } catch (err) {
        console.error("Failed to parse csl_json for reset in mass citation modal", err);
      }
    }

    // Reset to the backup loaded when modal was opened
    const original = initialArticles.find(art => art.id === editingArticle.id);
    if (original) {
      setEditableFields({ ...original });
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={onClose}>
      <div 
        className="card fade-in" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '850px', 
          width: '90%', 
          maxHeight: '90vh', 
          overflow: 'hidden', 
          background: 'var(--bg-main)', 
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, color: 'var(--text-heading)' }}>Citação em Massa (Artigos Lidos)</h2>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={onClose}><X size={20} /></button>
          </div>

          {editingArticle ? (
            /* Individual editing panel */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', background: 'var(--bg-surface)', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)' }}>Editar Metadados da Citação</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Título</label>
                  <input name="title" value={editableFields.title || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Autores (separados por ; ou ,)</label>
                  <input name="authors" value={editableFields.authors || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.2' }}>
                    Se usar vírgula, use nomes completos (ex: 'João Silva, Maria Souza') para evitar que nomes simples sejam lidos como um único autor.
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Ano</label>
                  <input name="year" type="number" value={editableFields.year || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>DOI</label>
                  <input name="doi" value={editableFields.doi || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Revista / Periódico</label>
                <input name="journal" value={editableFields.journal || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Volume</label>
                  <input name="volume" value={editableFields.volume || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Edição (Issue)</label>
                  <input name="issue" value={editableFields.issue || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Páginas</label>
                  <input name="pages" value={editableFields.pages || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Disponível em (URL)</label>
                  <input name="url" value={editableFields.url || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Acesso em</label>
                  <input name="accessed" type="date" value={editableFields.accessed || ''} onChange={handleFieldChange} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditingArticle(null)} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancelar</button>
                <button type="button" onClick={handleResetEdit} className="btn-secondary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <RotateCcw size={14} /> Resetar
                </button>
                <button type="button" onClick={handleSaveEdit} disabled={saving} className="btn-primary" style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          ) : (
            /* Main view: Controls + References List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Controls Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr', gap: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Estilo da Citação:</label>
                  <select 
                    value={style} 
                    onChange={e => setStyle(e.target.value as CitationStyle)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
                  >
                    <option value="abnt">ABNT</option>
                    <option value="apa">APA</option>
                    <option value="vancouver">Vancouver</option>
                    <option value="harvard1">Harvard</option>
                    <option value="ieee">IEEE</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Opções:</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <input 
                      type="checkbox" 
                      checked={useEtAl} 
                      onChange={e => setUseEtAl(e.target.checked)} 
                      style={{ cursor: 'pointer' }}
                    />
                    Usar "et al."
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Forma de Exibição:</label>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button 
                      onClick={() => setFormat('html')}
                      className={format === 'html' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}
                    >
                      <FileText size={14} /> HTML
                    </button>
                    <button 
                      onClick={() => setFormat('text')}
                      className={format === 'text' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}
                    >
                      <Code size={14} /> Texto
                    </button>
                    <button 
                      onClick={() => setFormat('bibtex')}
                      className={format === 'bibtex' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}
                    >
                      <Braces size={14} /> BibTeX
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Critério de Ordenação:</label>
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as 'author' | 'year')}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
                  >
                    <option value="author">Ordem Alfabética (Autor)</option>
                    <option value="year">Ordem Cronológica (Ano)</option>
                  </select>
                </div>
              </div>

              {/* Citations list container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div 
                  style={{ 
                    padding: '1.5rem', 
                    background: 'var(--bg-surface)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)',
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                  }}
                >
                  {sortedArticles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum artigo marcado como lido neste projeto.</div>
                  ) : (
                    sortedArticles.map((art, index) => {
                      const citText = generateCitation(art, style, format, useEtAl);
                      return (
                        <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                          <div 
                            style={{ 
                              flex: 1, 
                              whiteSpace: format === 'html' ? 'normal' : 'pre-wrap',
                              fontFamily: format === 'html' ? 'inherit' : 'monospace',
                              fontSize: format === 'html' ? '0.95rem' : '0.85rem',
                              lineHeight: '1.5'
                            }}
                          >
                            <span style={{ fontWeight: 600, marginRight: '0.5rem', color: 'var(--color-primary)' }}>[{index + 1}]</span>
                            {format === 'html' ? (
                              <span dangerouslySetInnerHTML={{ __html: citText }} />
                            ) : (
                              citText
                            )}
                          </div>
                          <button 
                            onClick={() => handleStartEdit(art)} 
                            className="btn-secondary" 
                            style={{ padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            title="Editar metadados para esta referência"
                          >
                            <Edit3 size={12} /> Editar
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Footer with actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignSelf: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>Fechar</button>
                <button 
                  onClick={handleCopyAll} 
                  disabled={sortedArticles.length === 0} 
                  className="btn-primary" 
                  style={{ padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar Todas'}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
