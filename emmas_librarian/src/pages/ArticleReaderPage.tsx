import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CopyPlus, Trash2, Edit2, Plus, ArrowLeft, Loader2, Upload, AlertCircle, ZoomIn, ZoomOut, Search, X as XIcon, ChevronLeft, ChevronRight, Key, Check, Tags } from 'lucide-react';
import { CitationModal } from '../components/CitationModal';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  PdfLoader, 
  PdfHighlighter, 
  Highlight, 
  Popup, 
  AreaHighlight 
} from 'react-pdf-highlighter';
import 'react-pdf-highlighter/dist/style/AreaHighlight.css';
import 'react-pdf-highlighter/dist/style/Highlight.css';
import 'react-pdf-highlighter/dist/style/MouseSelection.css';
import 'react-pdf-highlighter/dist/style/PdfHighlighter.css';
import 'react-pdf-highlighter/dist/style/Tip.css';
import 'react-pdf-highlighter/dist/style/pdf_viewer.css';
// @ts-ignore
import * as pdfjs from 'pdfjs-dist/build/pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up the worker for PDF.js to load via Vite's asset pipeline
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

import { projectService } from '../services/api';
import type { Article } from '../types';
import { CategoryCell } from '../components/CategoryCell';
import { HelpButton } from '../components/HelpButton';
import { EditArticleModal } from '../components/EditArticleModal';
import { QuotaModal } from '../components/QuotaModal';
import { anchorPendingHighlights } from '../utils/pdfTextSearch';

const isArticleManual = (article: Article) => {
  try {
    return JSON.parse(article.source_databases as string).includes('Manual');
  } catch {
    return false;
  }
};

export const ArticleReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState("1");
  const [article, setArticle] = useState<Article | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [standaloneAnnotations, setStandaloneAnnotations] = useState<any[]>([]);
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);

  const [scale, setScale] = useState(1.0);
  const [sidebarTab, setSidebarTab] = useState<'annotations' | 'search' | 'ai' | 'writer'>('annotations');
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [projectCategories, setProjectCategories] = useState<any[]>([]);
  const [articleCategories, setArticleCategories] = useState<any[]>([]);

  const [aiSummary, setAiSummary] = useState<{ generalSummary: string; sectionSummary: string } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [showKeyAlert, setShowKeyAlert] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [anchoringStatus, setAnchoringStatus] = useState<string>('');
  
  const [writingPadContent, setWritingPadContent] = useState('');
  const [isSavingPad, setIsSavingPad] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const highlighterRef = useRef<any>(null);

  const handleUnlinkClick = async () => {
    if (!id || !article) return;
    if (window.confirm("Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.")) {
      try {
        await projectService.unlinkPdf(parseInt(id));
        setPdfUrl('');
        setAiSummary(null);
        await fetchData();
      } catch (err) {
        alert('Erro ao desvincular o PDF');
      }
    }
  };

  const handlePadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setWritingPadContent(val);
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setIsSavingPad(true);
    saveTimeoutRef.current = setTimeout(async () => {
      if (article?.project_id) {
        try {
          await projectService.updateProjectWritingPad(article.project_id, val);
        } catch (error) {
          console.error("Erro ao salvar rascunho:", error);
        }
      }
      setIsSavingPad(false);
    }, 1000);
  };

  const handleSearch = async (pdfDoc: any) => {
    if (!searchQuery.trim() || !pdfDoc) return;
    setIsSearching(true);
    setSearchResults([]);
    const results: any[] = [];
    
    try {
      const totalPages = pdfDoc.numPages;
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const textItems = textContent.items.map((item: any) => item.str + (item.hasEOL ? '\n' : ''));
        const fullText = textItems.join('');
        
        let index = 0;
        const queryLower = searchQuery.toLowerCase();
        const textLower = fullText.toLowerCase();
        
        while ((index = textLower.indexOf(queryLower, index)) !== -1) {
          const start = Math.max(0, index - 40);
          const end = Math.min(fullText.length, index + queryLower.length + 45);
          let snippet = fullText.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < fullText.length) snippet = snippet + '...';
          
          results.push({
            pageNumber: pageNum,
            snippet: snippet,
            matchIndex: index,
            highlightStart: index - start + (start > 0 ? 3 : 0),
          });
          
          index += queryLower.length;
        }
      }
      setSearchResults(results);
    } catch (err) {
      console.error("Erro ao pesquisar no PDF:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!hasAiKey) {
      setShowKeyAlert(true);
      return;
    }
    if (!id) return;
    setIsGeneratingAi(true);
    try {
      const summary = await projectService.generateSummary(parseInt(id));
      setAiSummary({
        generalSummary: summary.generalSummary?.replace(/\\n/g, '\n') || '',
        sectionSummary: summary.sectionSummary?.replace(/\\n/g, '\n') || '',
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('429') || err.message.includes('QUOTA_EXCEEDED'))) {
        setShowQuotaModal(true);
      } else {
        alert("Erro ao gerar resumo: " + err.message);
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleResultClick = (pageNum: number) => {
    if (highlighterRef.current) {
      try {
        highlighterRef.current.scrollTo({ 
          position: { 
            pageNumber: pageNum,
            boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 }
          } 
        });
        setCurrentPage(pageNum);
        setInputPage(pageNum.toString());
      } catch (e) {
        console.error("Erro ao scrollar para a página:", e);
      }
    }
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const artData = await projectService.getArticle(parseInt(id));
      
      const [highData, annData, openai, gemini, anthropic, ollama, padContent, pCats, aCats] = await Promise.all([
        projectService.getHighlights(parseInt(id)),
        projectService.getAnnotations(parseInt(id)),
        projectService.getSetting('api_key_openai'),
        projectService.getSetting('api_key_gemini'),
        projectService.getSetting('api_key_anthropic'),
        projectService.getSetting('api_key_ollama'),
        projectService.getProjectWritingPad(artData.project_id),
        projectService.getProjectCategories(artData.project_id),
        projectService.getArticleCategories(parseInt(id))
      ]);
      setArticle(artData);
      setHasAiKey(!!(openai || gemini || anthropic || ollama));
      setProjectCategories(pCats);
      setArticleCategories(aCats);
      
      if (padContent !== null && padContent !== undefined) {
        setWritingPadContent(padContent);
      }
      
      const attachedAnnIds = new Set(highData.map((h: any) => h.annotation_id));
      setStandaloneAnnotations(annData.filter((a: any) => !attachedAnnIds.has(a.id)));

      setHighlights(highData.map((h: any) => ({
        id: h.id.toString(),
        position: h.position_data,
        content: { text: h.content_text || h.comment || '' },
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
        const localUrl = URL.createObjectURL(blob);
        setPdfUrl(localUrl);
        
        // Process pending highlights asynchronously
        const pendings = await projectService.getPendingHighlights(parseInt(id));
        if (pendings && pendings.length > 0) {
          try {
            const { anchoredHighlights, unanchoredHighlights } = await anchorPendingHighlights(localUrl, pendings, setAnchoringStatus);
            if (anchoredHighlights && anchoredHighlights.length > 0) {
              for (const anchor of anchoredHighlights) {
                await projectService.createHighlight(
                  parseInt(id),
                  anchor.color,
                  anchor.position,
                  anchor.content.text,
                  anchor.comment.text
                );
                await projectService.deletePendingHighlight(anchor.pendingId);
              }
              // Refresh highlights after saving
              const newHighData = await projectService.getHighlights(parseInt(id));
              setHighlights(newHighData.map((h: any) => ({
                id: h.id.toString(),
                position: h.position_data,
                content: { text: h.content_text || h.comment || '' },
                comment: { text: h.comment || '', emoji: '' },
                annotation_id: h.annotation_id
              })));
            }
            // If some couldn't be anchored, create standalone annotations so they aren't lost
            if (unanchoredHighlights && unanchoredHighlights.length > 0) {
              for (const unanchored of unanchoredHighlights) {
                const markdown = `**[Destaque não ancorado]**\n\n**Comentário:** ${unanchored.comment}\n\n**Citação no texto:** "${unanchored.quote}"`;
                await projectService.createAnnotation(parseInt(id), markdown);
                await projectService.deletePendingHighlight(unanchored.id);
              }
              // Refresh standalone annotations
              const newAnnData = await projectService.getAnnotations(parseInt(id));
              const currentHighData = await projectService.getHighlights(parseInt(id));
              const currentAttachedAnnIds = new Set(currentHighData.map((h: any) => h.annotation_id));
              setStandaloneAnnotations(newAnnData.filter((a: any) => !currentAttachedAnnIds.has(a.id)));
            }
          } catch (e) {
            console.error("Failed to anchor highlights:", e);
          } finally {
            setAnchoringStatus('');
          }
        }
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
    if (isCategoriesOpen) {
      fetchData();
    }
  }, [isCategoriesOpen, fetchData]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    let isActive = true;
    let initialTimer: any;
    let observerTimer: any;

    const cleanupDom = () => {
      document.querySelectorAll('.textLayer span mark').forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
          parent.textContent = parent.textContent; 
        }
      });
      document.querySelectorAll('.textLayer').forEach(layer => {
        Array.from(layer.attributes).forEach(attr => {
          if (attr.name.startsWith('data-search-highlighted')) {
            layer.removeAttribute(attr.name);
          }
        });
      });
    };

    if (sidebarTab === 'search' && !isSearching && searchQuery.trim().length > 2) {
      const query = searchQuery.trim().toLowerCase();
      
      const highlightText = () => {
        if (!isActive) return;
        
        const executeHighlight = () => {
          if (!isActive) return;
          const textLayers = document.querySelectorAll('.textLayer');
          
          const queryKey = query.replace(/[^a-z0-9]/g, '_');

          textLayers.forEach(layer => {
            if (layer.hasAttribute('data-search-highlighted-' + queryKey)) return;
            layer.setAttribute('data-search-highlighted-' + queryKey, 'true');
            
            const spans = layer.querySelectorAll('span');
            spans.forEach(span => {
              // Only mutate pure text nodes to avoid breaking complex pdf.js internal structures
              if (span.children.length > 0 && !span.querySelector('mark')) return; 
              
              if (!span.querySelector('mark') && span.textContent && span.textContent.toLowerCase().includes(query)) {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');
                
                const safeText = span.textContent
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;');
                  
                span.innerHTML = safeText.replace(regex, '<mark style="background-color: rgba(234, 179, 8, 0.4); color: inherit; border-radius: 2px;">$1</mark>');
              }
            });
          });
        };

        // Use requestIdleCallback to wait for pdf.js to finish its heavy layout calculations
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(executeHighlight, { timeout: 1000 });
        } else {
          executeHighlight();
        }
      };
      
      initialTimer = setTimeout(highlightText, 400);
      
      const observer = new MutationObserver((mutations) => {
        let shouldHighlight = false;
        mutations.forEach(m => {
          if (m.addedNodes.length) shouldHighlight = true;
        });
        if (shouldHighlight) {
          if (observerTimer) clearTimeout(observerTimer);
          observerTimer = setTimeout(highlightText, 400);
        }
      });
      
      const viewer = document.getElementById('pdf-container');
      if (viewer) {
        observer.observe(viewer, { childList: true, subtree: true });
      }
      
      return () => {
        isActive = false;
        clearTimeout(initialTimer);
        if (observerTimer) clearTimeout(observerTimer);
        observer.disconnect();
        cleanupDom();
      };
    } else {
      // Cleanup highlights if tab is changed or query is cleared
      cleanupDom();
    }
  }, [searchQuery, isSearching, sidebarTab]);

  useEffect(() => {
    let scrollTimeout: any = null;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Find the element at the center of the viewport
        const centerElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        const pageElement = centerElement?.closest('[data-page-number]');
        
        if (pageElement) {
          const topPage = parseInt(pageElement.getAttribute('data-page-number') || '1');
          if (!isNaN(topPage)) {
            setCurrentPage(prev => {
              if (prev !== topPage) {
                setInputPage(topPage.toString());
                return topPage;
              }
              return prev;
            });
          }
        }
      }, 50); // Debounce to prevent layout thrashing
    };

    // Listen to all scroll events in capture phase to ensure we catch internal container scrolls
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const goToPage = (pageNum: number) => {
    if (highlighterRef.current) {
      highlighterRef.current.scrollTo({ 
        position: { 
          pageNumber: pageNum,
          boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 }
        } 
      });
      setCurrentPage(pageNum);
      setInputPage(pageNum.toString());
    }
  };

  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>, totalPages: number) => {
    if (e.key === 'Enter') {
      const p = parseInt(inputPage);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        goToPage(p);
      } else {
        setInputPage(currentPage.toString());
      }
    }
  };

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
        highlight.content.text,
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

  const handleEditMetadataSubmit = async (data: any) => {
    if (!article) return;
    await projectService.updateArticleMetadata(article.id, data);
    await fetchData();
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
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', overflow: 'hidden' }}>
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
        zIndex: 10,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
          <Link to={`/projects/${article.project_id}`} style={{ textDecoration: 'none', color: 'var(--text-muted)', flexShrink: 0, transition: 'color var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
            <ArrowLeft size={20} />
          </Link>
          <h2 style={{ margin: 0, fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-heading)' }}>
            {article.title}
          </h2>
          {isArticleManual(article) && (
            <button 
              onClick={() => setIsEditingMetadata(true)} 
              className="btn-secondary" 
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              title="Editar Metadados"
            >
              <Edit2 size={14} /> Editar Metadados
            </button>
          )}
          <button 
            onClick={() => setIsCitationModalOpen(true)}
            className="btn-secondary" 
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="Gerar Citação"
          >
            <CopyPlus size={14} /> Citar
          </button>
          <HelpButton style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} />
        </div>

        {!hasLocalFile ? (
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <button 
                onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))))} 
                className="btn-secondary" 
                style={{ padding: '0.3rem', border: 'none', background: 'transparent' }} 
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.5rem', minWidth: '45px', textAlign: 'center', color: 'var(--text-main)' }}>
                {Math.round(scale * 100)}%
              </span>
              <button 
                onClick={() => setScale(s => Math.min(2.5, parseFloat((s + 0.1).toFixed(1))))} 
                className="btn-secondary" 
                style={{ padding: '0.3rem', border: 'none', background: 'transparent' }} 
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button 
                onClick={() => setScale(1.0)} 
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
              >
                Reset
              </button>
            </div>

            <button 
              onClick={handleUnlinkClick}
              className="btn-secondary"
              style={{ color: 'var(--color-danger)', fontSize: '0.9rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <XIcon size={16} /> Desvincular PDF
            </button>
          </div>
        )}
      </header>

      <div style={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
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
          <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            <PdfLoader 
              url={pdfUrl} 
              workerSrc={pdfWorkerUrl}
              beforeLoad={<div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /> Carregando PDF...</div>}
              errorMessage={<div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger)' }}><AlertCircle size={48} style={{ margin: '0 auto 1rem auto' }} /><h3>Erro ao carregar o PDF</h3><p>O arquivo PDF pode estar corrompido ou o caminho está inacessível.</p></div>}
              onError={(error) => console.error("PdfLoader falhou:", error)}
            >
              {(pdfDocument) => (
                <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
                  <div id="pdf-container" style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                    <PdfHighlighter
                      key={scale}
                      ref={highlighterRef}
                      pdfDocument={pdfDocument}
                      pdfScaleValue={scale.toString()}
                      enableAreaSelection={(event) => event.altKey}
                      scrollRef={() => {}}
                      onScrollChange={() => {}}
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

                        const handleContextMenu = (e: React.MouseEvent) => {
                          if (highlight.content && highlight.content.text) {
                            e.preventDefault();
                            e.stopPropagation();
                            navigator.clipboard.writeText(highlight.content.text);
                            showToast('Texto copiado!');
                          }
                        };

                        if (!highlight.comment?.text) {
                          return (
                            <div key={index} onContextMenu={handleContextMenu}>
                              {component}
                            </div>
                          );
                        }

                        return (
                          <div key={index} onContextMenu={handleContextMenu}>
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
                            >
                              {component}
                            </Popup>
                          </div>
                        );
                      }}
                      highlights={highlights}
                    />
                    
                    {/* Floating Page Navigator */}
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '1.5rem', 
                      left: '50%', 
                      transform: 'translateX(-50%)', 
                      zIndex: 100, 
                      display: 'flex', 
                      gap: '0.75rem', 
                      background: 'var(--bg-surface)', 
                      padding: '0.5rem 1rem', 
                      borderRadius: 'var(--radius-xl)', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
                      alignItems: 'center',
                      border: '1px solid var(--border-color)'
                    }}>
                      <button 
                        onClick={() => goToPage(currentPage - 1)} 
                        disabled={currentPage <= 1}
                        style={{ background: 'none', border: 'none', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-heading)', display: 'flex' }}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        <input 
                          type="text" 
                          value={inputPage}
                          onChange={(e) => setInputPage(e.target.value)}
                          onKeyDown={(e) => handlePageInputSubmit(e, pdfDocument.numPages)}
                          onBlur={() => setInputPage(currentPage.toString())}
                          style={{
                            width: '40px',
                            textAlign: 'center',
                            padding: '0.2rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-main)',
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            outline: 'none'
                          }}
                        />
                        <span> / {pdfDocument.numPages}</span>
                      </div>
                      <button 
                        onClick={() => goToPage(currentPage + 1)} 
                        disabled={currentPage >= pdfDocument.numPages}
                        style={{ background: 'none', border: 'none', cursor: currentPage >= pdfDocument.numPages ? 'not-allowed' : 'pointer', color: currentPage >= pdfDocument.numPages ? 'var(--text-muted)' : 'var(--text-heading)', display: 'flex' }}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Sidebar with Tabs */}
                  <div style={{ 
                    width: '320px', 
                    borderLeft: '1px solid var(--border-color)', 
                    background: 'var(--bg-surface)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden'
                  }}>
                    {/* Tab Selector */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                      <button
                        onClick={() => setSidebarTab('annotations')}
                        style={{
                          flex: 1,
                          padding: '0.8rem',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: sidebarTab === 'annotations' ? '2px solid var(--color-primary)' : '2px solid transparent',
                          color: sidebarTab === 'annotations' ? 'var(--color-primary)' : 'var(--text-muted)',
                          fontWeight: sidebarTab === 'annotations' ? 600 : 500,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        Anotações
                      </button>
                      <button
                        onClick={() => setSidebarTab('search')}
                        style={{
                          flex: 1,
                          padding: '0.8rem',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: sidebarTab === 'search' ? '2px solid var(--color-primary)' : '2px solid transparent',
                          color: sidebarTab === 'search' ? 'var(--color-primary)' : 'var(--text-muted)',
                          fontWeight: sidebarTab === 'search' ? 600 : 500,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        Pesquisar
                      </button>
                      <button
                        onClick={() => setSidebarTab('ai')}
                        style={{
                          flex: 1,
                          padding: '0.8rem',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: sidebarTab === 'ai' ? '2px solid var(--color-primary)' : '2px solid transparent',
                          color: sidebarTab === 'ai' ? 'var(--color-primary)' : 'var(--text-muted)',
                          fontWeight: sidebarTab === 'ai' ? 600 : 500,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        Insights IA
                      </button>
                    </div>

                    {/* Tab Content */}
                    {sidebarTab === 'annotations' ? (
                      <>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)', marginBottom: '1rem' }}>
                            Anotações ({highlights.length + standaloneAnnotations.length})
                          </h3>
                          
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
                      </>
                    ) : sidebarTab === 'search' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)', marginBottom: '1rem' }}>
                            Buscar no PDF
                          </h3>
                          <form onSubmit={(e) => { e.preventDefault(); handleSearch(pdfDocument); }} style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Termo para busca..."
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.6rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-main)',
                                  color: 'var(--text-main)',
                                  fontSize: '0.85rem',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSearching || !searchQuery.trim()}
                              className="btn-primary"
                              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            </button>
                          </form>
                        </div>

                        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {isSearching ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                              Pesquisando termo...
                            </div>
                          ) : searchResults.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
                              {searchQuery ? 'Nenhum resultado encontrado.' : 'Digite um termo para pesquisar.'}
                            </p>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
                                {searchResults.length} ocorrência(s) encontrada(s)
                              </div>
                              {searchResults.map((res, idx) => (
                                <div
                                  key={`search-${idx}`}
                                  onClick={() => handleResultClick(res.pageNumber)}
                                  className="card hover-lift"
                                  style={{
                                    padding: '0.75rem',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-main)',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                    <span>Página {res.pageNumber}</span>
                                  </div>
                                  <div style={{ color: 'var(--text-main)', lineHeight: '1.4' }}>
                                    {(() => {
                                      const term = searchQuery;
                                      const lowerSnippet = res.snippet.toLowerCase();
                                      const lowerTerm = term.toLowerCase();
                                      const termIdx = lowerSnippet.indexOf(lowerTerm);
                                      
                                      if (termIdx === -1) return res.snippet;
                                      
                                      const before = res.snippet.substring(0, termIdx);
                                      const match = res.snippet.substring(termIdx, termIdx + term.length);
                                      const after = res.snippet.substring(termIdx + term.length);
                                      
                                      return (
                                        <>
                                          {before}
                                          <mark style={{ background: 'rgba(234, 179, 8, 0.3)', color: 'var(--text-heading)', fontWeight: 600, padding: '0 0.1rem', borderRadius: '2px' }}>
                                            {match}
                                          </mark>
                                          {after}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                    {sidebarTab === 'ai' && (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(79, 70, 229, 0.05)' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Resumo com IA
                          </h3>
                          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Gere um resumo detalhado usando o modelo configurado.</p>
                          <button
                            onClick={handleGenerateSummary}
                            disabled={isGeneratingAi}
                            className="btn-primary"
                            style={{ width: '100%', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          >
                            {isGeneratingAi ? (
                              <><Loader2 size={16} className="animate-spin" /> Gerando Resumo...</>
                            ) : (
                              <>Gerar Resumo com IA</>
                            )}
                          </button>
                        </div>
                        <div style={{ padding: '1rem', flexGrow: 1 }}>
                          {!aiSummary ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                              Nenhum resumo gerado ainda. Clique no botão acima para iniciar.
                            </div>
                          ) : (
                            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)', fontSize: '0.95rem' }}>Visão Geral</h4>
                                <div className="markdown-body" style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary.generalSummary}</ReactMarkdown>
                                </div>
                              </div>
                              <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)', fontSize: '0.95rem' }}>Por Seções</h4>
                                <div className="markdown-body" style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary.sectionSummary}</ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </PdfLoader>
          </div>
        )}
      </div>

      {isEditingMetadata && article && (
        <EditArticleModal
          isOpen={true}
          onClose={() => setIsEditingMetadata(false)}
          article={article}
          onSubmit={handleEditMetadataSubmit}
        />
      )}

      {showKeyAlert && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '450px', background: 'var(--bg-surface)', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Key size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0' }}>Chave de IA Necessária</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Para usar os recursos de Inteligência Artificial, você precisa primeiro configurar sua chave de API (OpenAI, Gemini, Anthropic ou modelo local) nas configurações do sistema.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowKeyAlert(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={() => navigate('/settings')} className="btn-primary" style={{ flex: 1 }}>Configurações</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <QuotaModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} />
      
      {toastMessage && createPortal(
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-primary)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', boxShadow: 'var(--shadow-lg)', zIndex: 99999, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <Check size={18} /> {toastMessage}
        </div>,
        document.body
      )}
      {isCitationModalOpen && article && (
        <CitationModal
          isOpen={isCitationModalOpen}
          onClose={() => setIsCitationModalOpen(false)}
          article={article}
        />
      )}
      {/* Floating Categories Button */}
      {id && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 100 }}>
          {isCategoriesOpen && (
            <div className="card fade-in" style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: '1rem',
              width: '300px', background: 'var(--bg-main)', padding: '1rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)' }}>Categorias</h3>
                <button onClick={() => setIsCategoriesOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <XIcon size={16} />
                </button>
              </div>
              {projectCategories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                  Nenhuma categoria cadastrada.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {projectCategories.map((cat) => {
                    const articleCat = articleCategories.find((ac: any) => ac.category_id === cat.id);
                    return (
                      <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>{cat.name}</label>
                        <CategoryCell articleId={parseInt(id)} category={cat} initialValue={articleCat ? articleCat.value : ''} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <button 
            onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
            className="btn-primary" 
            style={{ 
              borderRadius: '2rem', 
              padding: '0.8rem 1.5rem', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title="Categorias do Artigo"
          >
            <Tags size={20} />
            Categorizar
          </button>
        </div>
      )}
    </div>
  );
};
