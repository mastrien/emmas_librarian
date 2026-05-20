import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trash2, Edit2, Plus, ArrowLeft, Loader2, Upload, AlertCircle } from 'lucide-react';
import { 
  PdfLoader, 
  PdfHighlighter, 
  Highlight, 
  Popup, 
  AreaHighlight 
} from 'react-pdf-highlighter';
import 'react-pdf-highlighter/dist/style.css';
// @ts-ignore
import * as pdfjs from 'pdfjs-dist/build/pdf';

// Set up the worker for PDF.js to load from local public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

import { projectService } from '../services/api';
import type { Article } from '../types';

export const ArticleReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [standaloneAnnotations, setStandaloneAnnotations] = useState<any[]>([]);
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const highlighterRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [artData, highData, annData] = await Promise.all([
        projectService.getArticle(parseInt(id)),
        projectService.getHighlights(parseInt(id)),
        projectService.getAnnotations(parseInt(id))
      ]);
      setArticle(artData);
      
      const attachedAnnIds = new Set(highData.map((h: any) => h.annotation_id));
      setStandaloneAnnotations(annData.filter((a: any) => !attachedAnnIds.has(a.id)));

      setHighlights(highData.map((h: any) => ({
        id: h.id.toString(),
        position: h.position_data,
        content: { text: h.comment || '' },
        comment: { text: h.comment || '', emoji: '' },
        annotation_id: h.annotation_id
      })));
      if (artData.local_file_path) {
        const buffer: any = await projectService.getPdfBuffer(parseInt(id));
        let uint8Array: Uint8Array;
        
        // Handle Electron IPC buffer serialization
        if (buffer && buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
          uint8Array = new Uint8Array(buffer.data);
        } else {
          uint8Array = new Uint8Array(buffer);
        }
        
        const blob = new Blob([uint8Array as any], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Erro ao carregar artigo', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleFileUpload = async () => {
    if (!id) return;
    setUploading(true);
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdf(parseInt(id), filePath);
        await fetchData();
      }
    } catch (err) {
      alert('Erro ao vincular PDF');
    } finally {
      setUploading(false);
    }
  };

  const addHighlight = async (highlight: any) => {
    if (!id) return;
    try {
      const response = await projectService.createHighlight(
        parseInt(id),
        'yellow',
        highlight.position,
        highlight.comment.text
      );
      setHighlights([{ ...highlight, id: response.id.toString(), annotation_id: response.annotation_id }, ...highlights]);
    } catch (err) {
      console.error('Erro ao salvar destaque', err);
    }
  };

  const handleCreateStandaloneAnnotation = async () => {
    if (!newAnnotationText.trim() || !id) return;
    try {
      const { id: annId } = await projectService.createAnnotation(parseInt(id), newAnnotationText);
      setStandaloneAnnotations([{ id: annId, content_markdown: newAnnotationText, created_at: new Date().toISOString() }, ...standaloneAnnotations]);
      setNewAnnotationText('');
    } catch (err) {
      console.error('Erro ao criar anotação avulsa', err);
    }
  };

  const handleDeleteHighlight = async (highlightId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir este destaque?")) {
      await projectService.deleteHighlight(parseInt(highlightId));
      setHighlights(highlights.filter(h => h.id !== highlightId));
    }
  };

  const handleDeleteStandaloneAnnotation = async (annId: string) => {
    if (confirm("Deseja realmente excluir esta anotação?")) {
      await projectService.deleteAnnotation(parseInt(annId));
      setStandaloneAnnotations(standaloneAnnotations.filter(a => a.id.toString() !== annId.toString()));
    }
  };

  const handleEditHighlightAnnotation = async (h: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!h.annotation_id) {
      alert("Este destaque não possui uma anotação vinculada inicial. Crie um novo destaque com texto.");
      return;
    }
    setEditingId(h.id);
    setEditContent(h.comment?.text || "");
  };

  const handleEditStandaloneAnnotation = async (a: any) => {
    setEditingId(a.id.toString());
    setEditContent(a.content_markdown);
  };

  const saveEdit = async (idToSave: string, annotationId: number, isStandalone: boolean) => {
    try {
      await projectService.updateAnnotation(annotationId, editContent);
      if (isStandalone) {
        setStandaloneAnnotations(standaloneAnnotations.map(x => x.id.toString() === idToSave ? { ...x, content_markdown: editContent } : x));
      } else {
        setHighlights(highlights.map(x => x.id === idToSave ? { ...x, comment: { text: editContent, emoji: '' } } : x));
      }
      setEditingId(null);
      setEditContent('');
    } catch (e) {
      console.error('Erro ao salvar edição', e);
      alert("Erro ao salvar edição.");
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando Leitor...</div>;
  if (!article) return <div style={{ textAlign: 'center', padding: '2rem' }}>Artigo não encontrado.</div>;

  const hasLocalFile = !!article.local_file_path;

  const renderTip = (
    position: any,
    content: any,
    hideTipAndSelection: () => void
  ) => {
    return (
      <div className="card fade-in" style={{ 
        padding: '1rem', 
        width: '240px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <textarea 
          id="tip-textarea"
          placeholder="Adicionar nota (opcional)..." 
          style={{ 
            width: '100%', 
            height: '70px', 
            marginBottom: '0.75rem', 
            display: 'block',
            padding: '0.6rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            fontSize: '0.85rem',
            outline: 'none',
            resize: 'none',
            transition: 'border-color var(--transition-fast)'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => {
              const textarea = document.getElementById('tip-textarea') as HTMLTextAreaElement;
              addHighlight({ content, position, comment: { text: textarea.value } });
              hideTipAndSelection();
            }}
            className="btn-primary"
            style={{ flexGrow: 1, padding: '0.5rem', fontSize: '0.85rem' }}
          >
            Destacar
          </button>
          <button 
            onClick={hideTipAndSelection}
            className="btn-secondary"
            style={{ padding: '0.5rem', fontSize: '0.85rem' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <header className="glass-panel" style={{ 
        padding: '1rem 1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        borderRadius: 0,
        boxShadow: 'var(--shadow-sm)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
          <Link to={`/projects/${article.project_id}`} style={{ textDecoration: 'none', color: 'var(--text-muted)', flexShrink: 0, transition: 'color var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
            <ArrowLeft size={20} />
          </Link>
          <h2 style={{ margin: 0, fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-heading)' }}>
            {article.title}
          </h2>
        </div>

        {!hasLocalFile && (
          <div>
            <button 
              onClick={handleFileUpload}
              disabled={uploading}
              className="btn-primary"
              style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Vincular PDF Local
            </button>
          </div>
        )}
      </header>

      <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
        {!hasLocalFile ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: 'var(--text-muted)',
            gap: '1.5rem',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{ padding: '1.5rem', background: 'var(--bg-surface)', borderRadius: '50%', boxShadow: 'var(--shadow-sm)' }}>
              <AlertCircle size={48} color="var(--color-secondary)" />
            </div>
            <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.5rem' }}>Nenhum PDF vinculado</h3>
            <p style={{ fontSize: '1rem', maxWidth: '400px', margin: 0 }}>Faça o upload do arquivo PDF deste artigo para começar a ler, anotar e fazer destaques diretamente no Emma's Librarian.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
            <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
              <PdfLoader url={pdfUrl} beforeLoad={<div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /> Carregando PDF...</div>}>
                {(pdfDocument) => (
                  <div style={{ height: '100%', width: '100%' }}>
                    <PdfHighlighter
                      ref={highlighterRef}
                      pdfDocument={pdfDocument}
                      enableAreaSelection={(event) => event.altKey}
                      onScrollChange={() => {}}
                      scrollRef={() => {}}
                      onSelectionFinished={(
                        position,
                        content,
                        hideTipAndSelection,
                        transformSelection
                      ) => renderTip(position, content, hideTipAndSelection)}
                      highlightTransform={(
                        highlight,
                        index,
                        setTip,
                        hideTip,
                        viewportToScaled,
                        screenshot,
                        isScrolledTo
                      ) => {
                        const isTextHighlight = !Boolean(highlight.content && highlight.content.image);

                        const component = isTextHighlight ? (
                          <Highlight
                            isScrolledTo={isScrolledTo}
                            position={highlight.position}
                            comment={highlight.comment}
                          />
                        ) : (
                          <AreaHighlight
                            isScrolledTo={isScrolledTo}
                            highlight={highlight}
                            onChange={() => {}}
                          />
                        );

                        if (!highlight.comment?.text) {
                          return <React.Fragment key={index}>{component}</React.Fragment>;
                        }

                        return (
                          <Popup
                            popupContent={
                              <div className="card fade-in" style={{ 
                                padding: '0.75rem 1rem', 
                                border: '1px solid var(--border-color)', 
                                boxShadow: 'var(--shadow-md)',
                                fontSize: '0.85rem',
                                maxWidth: '220px',
                                wordBreak: 'break-word',
                                color: 'var(--text-main)',
                                lineHeight: '1.4'
                              }}>
                                {highlight.comment.text}
                              </div>
                            }
                            onMouseOver={(popupContent) =>
                              setTip(highlight, (highlight) => popupContent)
                            }
                            onMouseOut={hideTip}
                            key={index}
                          >
                            {component}
                          </Popup>
                        );
                      }}
                      highlights={highlights}
                    />
                  </div>
                )}
              </PdfLoader>
            </div>
            
            <div style={{ 
              width: '320px', 
              borderLeft: '1px solid var(--border-color)', 
              background: 'var(--bg-surface)', 
              display: 'flex', 
              flexDirection: 'column' 
            }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)', marginBottom: '1rem' }}>Anotações ({highlights.length + standaloneAnnotations.length})</h3>
                
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
                    onClick={handleCreateStandaloneAnnotation}
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
                          <button onClick={() => handleEditStandaloneAnnotation(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteStandaloneAnnotation(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div style={{ color: 'var(--text-heading)', fontWeight: 500, paddingRight: '2rem' }}>
                          {editingId === a.id.toString() ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%', height: '60px', padding: '0.5rem',
                                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                                  background: 'var(--bg-main)', color: 'var(--text-main)',
                                  fontSize: '0.85rem', outline: 'none', resize: 'none'
                                }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => saveEdit(a.id.toString(), a.id, true)} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Salvar</button>
                                <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            a.content_markdown
                          )}
                        </div>
                      </div>
                    ))}

                    {highlights.map((h, idx) => {
                      const pageNum = h.position?.boundingRect?.pageNumber || h.position?.pageNumber;
                      return (
                        <div 
                          key={`high-${h.id || idx}`} 
                          className="card hover-lift" 
                          onClick={() => {
                            if (highlighterRef.current) {
                              highlighterRef.current.scrollTo(h);
                            }
                          }}
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
                              <button onClick={(e) => handleEditHighlightAnnotation(h, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Editar">
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button onClick={(e) => handleDeleteHighlight(h.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          {pageNum && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                              Página {pageNum}
                            </div>
                          )}
                          <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', paddingRight: '2.5rem' }}>
                            "{h.content?.text?.substring(0, 80)}{h.content?.text?.length > 80 ? '...' : ''}"
                          </div>
                          {editingId === h.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                style={{
                                  width: '100%', height: '60px', padding: '0.5rem',
                                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                                  background: 'var(--bg-main)', color: 'var(--text-main)',
                                  fontSize: '0.85rem', outline: 'none', resize: 'none'
                                }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={(e) => { e.stopPropagation(); saveEdit(h.id, h.annotation_id, false); }} className="btn-primary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Salvar</button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="btn-secondary" style={{ flex: 1, padding: '0.25rem', fontSize: '0.8rem' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            h.comment?.text && (
                              <div style={{ color: 'var(--text-heading)', fontWeight: 500 }}>
                                {h.comment.text}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
