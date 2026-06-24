// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  CopyPlus,
  Trash2,
  Edit2,
  Plus,
  ArrowLeft,
  Loader2,
  Upload,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Search,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  Key,
  Check,
  Tags,
  ExternalLink,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { CitationModal } from '../components/modals/CitationModal';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import { TipContent } from '../components/reader/TipContent';
import { PdfPlaceholderView } from '../components/reader/PdfPlaceholderView';
import { FloatingCategoriesPanel } from '../components/reader/FloatingCategoriesPanel';
import { ReaderSidebar } from '../components/reader/ReaderSidebar';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PdfLoader, PdfHighlighter, Highlight, Popup, AreaHighlight } from 'react-pdf-highlighter';

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
pdfjs.GlobalWorkerOptions.standardFontDataUrl = 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/';

import { useProjectService } from '../contexts/ServicesContext';
import type { Article, Annotation, ProjectCategory, ArticleCategory, Highlight as AppHighlight } from '../types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { CategoryCell } from '../components/common/CategoryCell';
import { HelpButton } from '../components/common/HelpButton';
import { EditArticleModal } from '../components/modals/EditArticleModal';
import { QuotaModal } from '../components/modals/QuotaModal';
import { anchorPendingHighlights } from '../utils/pdfTextSearch';

const isArticleManual = (article: Article) => {
  try {
    return JSON.parse(article.source_databases as string).includes('Manual');
  } catch {
    return false;
  }
};

export const ArticleReaderPage: React.FC = () => {
  const projectService = useProjectService();
  const { showError } = useGlobalError();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState('1');
  const [article, setArticle] = useState<Article | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [standaloneAnnotations, setStandaloneAnnotations] = useState<Annotation[]>([]);
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
  const scrollPositionRef = useRef<number>(0);

  const handleZoom = (updater: number | ((s: number) => number)) => {
    setScale((s) => {
      const newScale = typeof updater === 'function' ? updater(s) : updater;
      return newScale;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setScale((s) => Math.min(s + 0.2, 3));
        } else if (e.key === '-') {
          e.preventDefault();
          setScale((s) => Math.max(s - 0.2, 0.5));
        } else if (e.key === '0') {
          e.preventDefault();
          setScale(1.0);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setScale((s) => Math.min(s + 0.1, 3));
        } else if (e.deltaY > 0) {
          setScale((s) => Math.max(s - 0.1, 0.5));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (highlighterRef.current && highlighterRef.current.viewer) {
      (highlighterRef.current as unknown as { viewer: { currentScaleValue: string } }).viewer.currentScaleValue =
        scale.toString();
    }
  }, [scale]);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('emma_sidebar_width') || '320', 10);
  });
  const isDraggingSidebar = useRef(false);
  const [sidebarTab, setSidebarTab] = useState<'annotations' | 'search' | 'ai' | 'writer'>('annotations');
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ pageNumber: number; snippet: string; matchIndex: number; highlightStart: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [articleCategories, setArticleCategories] = useState<ArticleCategory[]>([]);

  const [aiSummary, setAiSummary] = useState<{ generalSummary: string; sectionSummary: string } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [showKeyAlert, setShowKeyAlert] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [anchoringStatus, setAnchoringStatus] = useState<string>('');

  const [writingPadContent, setWritingPadContent] = useState('');
  const [isSavingPad, setIsSavingPad] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const highlighterRef = useRef<{ viewer?: { currentScaleValue: string }; scrollTo: (h: unknown) => void } | null>(
    null,
  );

  const handleUnlinkClick = async () => {
    if (!id || !article) return;
    if (
      window.confirm(
        'Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.',
      )
    ) {
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
          console.error('Erro ao salvar rascunho:', error);
        }
      }
      setIsSavingPad(false);
    }, 1000);
  };

  const handleSearch = async (pdfDoc: PDFDocumentProxy) => {
    if (!searchQuery.trim() || !pdfDoc) return;
    setIsSearching(true);
    setSearchResults([]);
    const results: Array<{ pageNumber: number; snippet: string; matchIndex: number; highlightStart: number }> = [];

    try {
      const totalPages = pdfDoc.numPages;
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        const textItems = textContent.items.map(
          (item: unknown) =>
            (item as { str: string; hasEOL: boolean }).str +
            ((item as { str: string; hasEOL: boolean }).hasEOL ? '\n' : ''),
        );
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
      console.error('Erro ao pesquisar no PDF:', err);
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
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message &&
        (err.message.includes('429') || err.message.includes('QUOTA_EXCEEDED'))
      ) {
        setShowQuotaModal(true);
      } else {
        showError(err);
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
            boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 },
          },
        });
        setCurrentPage(pageNum);
        setInputPage(pageNum.toString());
      } catch (e) {
        console.error('Erro ao scrollar para a página:', e);
      }
    }
  };
  const fetchCategories = useCallback(async () => {
    if (!id || !article) return;
    try {
      const [pCats, aCats] = await Promise.all([
        projectService.getProjectCategories(article.project_id),
        projectService.getArticleCategories(parseInt(id)),
      ]);
      setProjectCategories(pCats as ProjectCategory[]);
      setArticleCategories(aCats as ArticleCategory[]);
    } catch (err) {
      console.error('Erro ao carregar categorias dinâmicas', err);
    }
  }, [id, article]);

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
        projectService.getArticleCategories(parseInt(id)),
      ]);
      setArticle(artData);
      setHasAiKey(!!(openai || gemini || anthropic || ollama));
      setProjectCategories(pCats as ProjectCategory[]);
      setArticleCategories(aCats as ArticleCategory[]);

      if (artData.ai_summary) {
        try {
          const parsed = JSON.parse(artData.ai_summary);
          setAiSummary({
            generalSummary: parsed.generalSummary?.replace(/\\n/g, '\n') || '',
            sectionSummary: parsed.sectionSummary?.replace(/\\n/g, '\n') || '',
          });
        } catch (e) {
          console.error('Falha ao carregar o resumo de IA do cache:', e);
        }
      } else {
        setAiSummary(null);
      }

      if (padContent !== null && padContent !== undefined) {
        setWritingPadContent(padContent);
      }

      const attachedAnnIds = new Set((highData as AppHighlight[]).map((h) => h.annotation_id));
      setStandaloneAnnotations(annData.filter((a: Annotation) => !attachedAnnIds.has(a.id)));

      setHighlights(
        highData.map(
          (h: {
            id: number;
            position_data: unknown;
            content_text?: string;
            comment?: string;
            color?: string;
            annotation_id?: number;
          }) =>
            ({
              id: h.id.toString(),
              article_id: parseInt(id),
              position: h.position_data,
              content: { text: h.content_text || h.comment || '' },
              comment: { text: h.comment || '' },
              color: h.color || 'yellow',
              annotation_id: h.annotation_id,
              position_data: h.position_data,
              content_text: h.content_text || h.comment || '',
              original_comment: h.comment || '',
            }) as any,
        ),
      );
      if (artData.local_file_path) {
        const buffer: unknown = await projectService.getPdfBuffer(parseInt(id));
        let uint8Array: Uint8Array;

        // Handle Electron IPC buffer serialization
        const buf = buffer as { type?: string; data?: number[] };
        if (buf && buf.type === 'Buffer' && Array.isArray(buf.data)) {
          uint8Array = new Uint8Array(buf.data as number[]);
        } else {
          uint8Array = new Uint8Array(buffer as ArrayBufferLike);
        }

        const blob = new Blob([uint8Array.buffer], { type: 'application/pdf' });
        const localUrl = URL.createObjectURL(blob);
        setPdfUrl(localUrl);

        // Process pending highlights asynchronously
        const pendings = await projectService.getPendingHighlights(parseInt(id));
        if (pendings && pendings.length > 0) {
          try {
            const { anchoredHighlights, unanchoredHighlights } = await anchorPendingHighlights(
              localUrl,
              pendings,
              setAnchoringStatus,
            );
            if (anchoredHighlights && anchoredHighlights.length > 0) {
              for (const anchor of anchoredHighlights) {
                await projectService.createHighlight(
                  parseInt(id),
                  anchor.color,
                  anchor.position,
                  anchor.content.text,
                  anchor.comment.text,
                );
                await projectService.deletePendingHighlight(anchor.pendingId);
              }
              // Refresh highlights after saving
              const newHighData = await projectService.getHighlights(parseInt(id));
              setHighlights(
                newHighData.map(
                  (h: {
                    id: number;
                    position_data: unknown;
                    content_text?: string;
                    comment?: string;
                    color?: string;
                    annotation_id?: number;
                  }) =>
                    ({
                      id: h.id.toString(),
                      article_id: parseInt(id),
                      position: h.position_data,
                      content: { text: h.content_text || h.comment || '' },
                      comment: { text: h.comment || '' },
                      color: h.color || 'yellow',
                      annotation_id: h.annotation_id,
                      position_data: h.position_data,
                      content_text: h.content_text || h.comment || '',
                      original_comment: h.comment || '',
                    }) as any,
                ),
              );
            }
            // If some couldn't be anchored, create standalone annotations so they aren't lost
            if (unanchoredHighlights && unanchoredHighlights.length > 0) {
              for (const unanchored of unanchoredHighlights) {
                const markdown = `[Destaque não ancorado]\n\nComentário: ${unanchored.comment}\n\nCitação no texto: "${unanchored.quote}"`;
                await projectService.createAnnotation(parseInt(id), markdown);
                await projectService.deletePendingHighlight(unanchored.id);
              }
              // Refresh standalone annotations
              const newAnnData = await projectService.getAnnotations(parseInt(id));
              const currentHighData = await projectService.getHighlights(parseInt(id));
              const currentAttachedAnnIds = new Set((currentHighData as AppHighlight[]).map((h) => h.annotation_id));
              setStandaloneAnnotations(newAnnData.filter((a: Annotation) => !currentAttachedAnnIds.has(a.id)));
            }
          } catch (e) {
            console.error('Failed to anchor highlights:', e);
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
    if (!loading && location.state?.searchQuery) {
      setSidebarTab('search');
      setSearchQuery(location.state.searchQuery);

      const page = location.state.page;
      if (page) {
        setTimeout(() => {
          goToPage(page);
        }, 300);
      }

      // Clear the state so we don't re-trigger on refresh
      window.history.replaceState({}, '');
    }
  }, [loading, location.state]);

  useEffect(() => {
    if (isCategoriesOpen) {
      fetchCategories();
    }
  }, [isCategoriesOpen, fetchCategories]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    let isActive = true;
    let initialTimer: number | NodeJS.Timeout;
    let observerTimer: number | NodeJS.Timeout;

    const cleanupDom = () => {
      document.querySelectorAll('.textLayer span mark').forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.textContent = parent.textContent;
        }
      });
      document.querySelectorAll('.textLayer').forEach((layer) => {
        Array.from(layer.attributes).forEach((attr) => {
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

          textLayers.forEach((layer) => {
            if (layer.hasAttribute('data-search-highlighted-' + queryKey)) return;
            layer.setAttribute('data-search-highlighted-' + queryKey, 'true');

            const spans = layer.querySelectorAll('span');
            spans.forEach((span) => {
              // Only mutate pure text nodes to avoid breaking complex pdf.js internal structures
              if (span.children.length > 0 && !span.querySelector('mark')) return;

              if (!span.querySelector('mark') && span.textContent && span.textContent.toLowerCase().includes(query)) {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');

                const safeText = span.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                span.innerHTML = safeText.replace(
                  regex,
                  '<mark style="background-color: rgba(234, 179, 8, 0.4); color: inherit; border-radius: 2px;">$1</mark>',
                );
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
        mutations.forEach((m) => {
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
    let scrollTimeout: number | NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Find the element at the center of the viewport
        const centerElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        const pageElement = centerElement?.closest('[data-page-number]');

        if (pageElement) {
          const topPage = parseInt(pageElement.getAttribute('data-page-number') || '1');
          if (!isNaN(topPage)) {
            setCurrentPage((prev) => {
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const newWidth = Math.max(350, Math.min(800, window.innerWidth - e.clientX));
      if (newWidth !== sidebarWidth) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      if (isDraggingSidebar.current) {
        isDraggingSidebar.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        localStorage.setItem('emma_sidebar_width', sidebarWidth.toString());
      }
    };

    const handleBlur = () => {
      isDraggingSidebar.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sidebarWidth]);

  const goToPage = (pageNum: number) => {
    if (highlighterRef.current) {
      highlighterRef.current.scrollTo({
        position: {
          pageNumber: pageNum,
          boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 },
        },
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
        highlight.color || 'yellow',
        highlight.position,
        highlight.content?.text || null,
        highlight.comment?.text || '',
      );
      setHighlights([
        {
          ...highlight,
          id: response.id.toString(),
          annotation_id: response.annotation_id,
          article_id: parseInt(id || '0'),
          position_data: highlight.position,
          content_text: highlight.content?.text,
          original_comment: highlight.comment?.text || '',
        },
        ...highlights,
      ]);
    } catch (err) {
      console.error('Erro ao salvar destaque', err);
    }
  };

  const handleCreateStandaloneAnnotation = async () => {
    if (!newAnnotationText.trim() || !id) return;
    try {
      const { id: annId } = await projectService.createAnnotation(parseInt(id), newAnnotationText);
      setStandaloneAnnotations([
        {
          id: annId,
          content_markdown: newAnnotationText,
          created_at: new Date().toISOString(),
          article_id: parseInt(id || '0'),
        },
        ...standaloneAnnotations,
      ]);
      setNewAnnotationText('');
    } catch (err) {
      console.error('Erro ao criar anotação avulsa', err);
    }
  };

  const handleDeleteHighlight = async (highlightId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja realmente excluir este destaque?')) {
      await projectService.deleteHighlight(parseInt(highlightId));
      setHighlights(highlights.filter((h) => h.id.toString() !== highlightId));
    }
  };

  const handleDeleteStandaloneAnnotation = async (annId: string) => {
    if (confirm('Deseja realmente excluir esta anotação?')) {
      await projectService.deleteAnnotation(parseInt(annId));
      setStandaloneAnnotations(standaloneAnnotations.filter((a) => a.id.toString() !== annId.toString()));
    }
  };

  const handleEditHighlightAnnotation = async (h: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!h.annotation_id) {
      alert('Este destaque não possui uma anotação vinculada inicial. Crie um novo destaque com texto.');
      return;
    }
    setEditingId(h.id);
    setEditContent(h.comment?.text || h.original_comment || '');
  };

  const handleEditStandaloneAnnotation = async (a: Annotation) => {
    setEditingId(a.id.toString());
    setEditContent(a.content_markdown);
  };

  const saveEdit = async (idToSave: string, annotationId: number, isStandalone: boolean) => {
    try {
      await projectService.updateAnnotation(annotationId, editContent);
      if (isStandalone) {
        setStandaloneAnnotations(
          standaloneAnnotations.map((x) =>
            x.id.toString() === idToSave ? { ...x, content_markdown: editContent } : x,
          ),
        );
      } else {
        setHighlights(
          highlights.map((x: any) =>
            x.id === idToSave ? { ...x, comment: { text: editContent }, original_comment: editContent } : x,
          ),
        );
      }
      setEditingId(null);
      setEditContent('');
    } catch (e) {
      console.error('Erro ao salvar edição', e);
      alert('Erro ao salvar edição.');
    }
  };

  const handleEditMetadataSubmit = async (data: Record<string, unknown>) => {
    if (!article) return;
    await projectService.updateArticleMetadata(article.id, data);
    await fetchData();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando Leitor...</div>;
  if (!article) return <div style={{ textAlign: 'center', padding: '2rem' }}>Artigo não encontrado.</div>;

  const hasLocalFile = !!article.local_file_path;

  const renderTip = (
    position: unknown,
    content: { text?: string; image?: string },
    hideTipAndSelection: () => void,
  ) => {
    return (
      <TipContent
        position={position}
        content={content}
        hideTipAndSelection={hideTipAndSelection}
        addHighlight={addHighlight as unknown as (h: unknown) => void}
      />
    );
  };

  return (
    <div
      className="fade-in"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        overflow: 'hidden',
      }}
    >
      <header
        className="glass-panel"
        style={{
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
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
          <Link
            to={`/projects/${article.project_id}`}
            style={{
              textDecoration: 'none',
              color: 'var(--text-muted)',
              flexShrink: 0,
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft size={20} />
          </Link>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-heading)',
            }}
          >
            {article.title}
          </h2>
          {isArticleManual(article) && (
            <button
              onClick={() => setIsEditingMetadata(true)}
              className="btn-secondary"
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
              title="Editar Metadados"
            >
              <Edit2 size={14} /> Editar Metadados
            </button>
          )}
          <button
            onClick={() => setIsCitationModalOpen(true)}
            className="btn-secondary"
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
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
            <div
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
              }}
            >
              <button
                onClick={() => handleZoom((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))))}
                style={{ background: 'none', border: 'none', color: 'var(--text-heading)', cursor: 'pointer' }}
                title="Menos zoom"
              >
                <ZoomOut size={18} />
              </button>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  minWidth: '40px',
                  textAlign: 'center',
                }}
              >
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => handleZoom((s) => Math.min(2.5, parseFloat((s + 0.1).toFixed(1))))}
                style={{ background: 'none', border: 'none', color: 'var(--text-heading)', cursor: 'pointer' }}
                title="Mais zoom"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => handleZoom(1.0)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px' }}
              >
                Reset
              </button>
            </div>

            <button
              onClick={handleUnlinkClick}
              className="btn-secondary"
              style={{
                color: 'var(--color-danger)',
                fontSize: '0.9rem',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <XIcon size={16} /> Desvincular PDF
            </button>
          </div>
        )}
      </header>

      <div style={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
        {!hasLocalFile && article ? (
          <PdfPlaceholderView article={article} uploading={uploading} onFileUpload={handleFileUpload} />
        ) : (
          <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            <PdfLoader
              url={pdfUrl}
              workerSrc={pdfWorkerUrl}
              beforeLoad={
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Loader2 className="animate-spin" /> Carregando PDF...
                </div>
              }
              errorMessage={
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger)' }}>
                  <AlertCircle size={48} style={{ margin: '0 auto 1rem auto' }} />
                  <h3>Erro ao carregar o PDF</h3>
                  <p>O arquivo PDF pode estar corrompido ou o caminho está inacessível.</p>
                </div>
              }
              onError={(error) => console.error('PdfLoader falhou:', error)}
            >
              {(pdfDocument) => (
                <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
                  <div id="pdf-container" style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                    <PdfHighlighter
                      ref={
                        highlighterRef as React.MutableRefObject<
                          PdfHighlighter<import('react-pdf-highlighter').IHighlight>
                        >
                      }
                      pdfDocument={pdfDocument}
                      pdfScaleValue={scale.toString()}
                      enableAreaSelection={(event) => event.altKey}
                      scrollRef={() => {}}
                      onScrollChange={() => {}}
                      onSelectionFinished={(position, content, hideTipAndSelection, transformSelection) =>
                        renderTip(position, content, hideTipAndSelection)
                      }
                      highlightTransform={(
                        highlight,
                        index,
                        setTip,
                        hideTip,
                        viewportToScaled,
                        screenshot,
                        isScrolledTo,
                      ) => {
                        const isTextHighlight = !Boolean(highlight.content && highlight.content.image);

                        const component = (
                          <div
                            className={`custom-highlight custom-highlight-${(highlight as unknown as AppHighlight).color || 'yellow'}`}
                          >
                            {isTextHighlight ? (
                              <Highlight
                                isScrolledTo={isScrolledTo}
                                position={highlight.position}
                                comment={highlight.comment}
                              />
                            ) : (
                              <AreaHighlight isScrolledTo={isScrolledTo} highlight={highlight} onChange={() => {}} />
                            )}
                          </div>
                        );

                        const handleContextMenu = (e: React.MouseEvent) => {
                          if (highlight.content && highlight.content.text) {
                            e.preventDefault();
                            e.stopPropagation();
                            navigator.clipboard.writeText(highlight.content.text);
                            showToast('Texto copiado!');
                          }
                        };

                        if (
                          !(highlight.comment as unknown as { text?: string })?.text &&
                          !(highlight as unknown as { comment?: string })?.comment
                        ) {
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
                                <div
                                  className="card fade-in"
                                  style={{
                                    padding: '0.75rem 1rem',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: 'var(--shadow-md)',
                                    fontSize: '0.85rem',
                                    maxWidth: '220px',
                                    wordBreak: 'break-word',
                                    color: 'var(--text-main)',
                                    lineHeight: '1.4',
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {(highlight.comment as { text?: string })?.text ||
                                    (highlight as unknown as { comment: string })?.comment ||
                                    ''}
                                </div>
                              }
                              onMouseOver={(popupContent) => setTip(highlight, (highlight) => popupContent)}
                              onMouseOut={hideTip}
                            >
                              {component}
                            </Popup>
                          </div>
                        );
                      }}
                      highlights={highlights as unknown as Array<import('react-pdf-highlighter').IHighlight>}
                    />

                    {/* Floating Page Navigator */}
                    <div
                      style={{
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
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                          color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-heading)',
                          display: 'flex',
                        }}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                        }}
                      >
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
                            outline: 'none',
                          }}
                        />
                        <span> / {pdfDocument.numPages}</span>
                      </div>
                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= pdfDocument.numPages}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: currentPage >= pdfDocument.numPages ? 'not-allowed' : 'pointer',
                          color: currentPage >= pdfDocument.numPages ? 'var(--text-muted)' : 'var(--text-heading)',
                          display: 'flex',
                        }}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Resizer Handle */}
                  <div
                    style={{
                      width: '4px',
                      cursor: 'col-resize',
                      background: 'var(--border-color)',
                      flexShrink: 0,
                      zIndex: 10,
                      transition: 'background 0.2s ease',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      isDraggingSidebar.current = true;
                      document.body.style.cursor = 'col-resize';
                      document.body.style.userSelect = 'none';
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isDraggingSidebar.current) {
                        e.currentTarget.style.background = 'var(--border-color)';
                      }
                    }}
                  />

                  {/* Sidebar with Tabs */}
                  <ReaderSidebar
                    width={sidebarWidth}
                    sidebarTab={sidebarTab}
                    setSidebarTab={setSidebarTab}
                    highlights={highlights as unknown as Array<import('react-pdf-highlighter').IHighlight>}
                    standaloneAnnotations={standaloneAnnotations}
                    newAnnotationText={newAnnotationText}
                    setNewAnnotationText={setNewAnnotationText}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    onCreateStandaloneAnnotation={handleCreateStandaloneAnnotation}
                    onDeleteHighlight={handleDeleteHighlight}
                    onDeleteStandaloneAnnotation={handleDeleteStandaloneAnnotation}
                    onEditHighlightAnnotation={
                      handleEditHighlightAnnotation as unknown as (h: Highlight, e: React.MouseEvent) => void
                    }
                    onEditStandaloneAnnotation={handleEditStandaloneAnnotation as unknown as (a: Annotation) => void}
                    onSaveEdit={saveEdit}
                    onHighlightClick={(h: unknown) => {
                      if (highlighterRef.current) {
                        highlighterRef.current.scrollTo(h);
                      }
                    }}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    isSearching={isSearching}
                    searchResults={searchResults}
                    onSearch={(e: React.FormEvent) => {
                      e.preventDefault();
                      handleSearch(pdfDocument);
                    }}
                    onResultClick={handleResultClick}
                    isGeneratingAi={isGeneratingAi}
                    aiSummary={aiSummary}
                    onGenerateSummary={handleGenerateSummary}
                  />
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

      {showKeyAlert &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="card fade-in"
              style={{
                width: '100%',
                maxWidth: '450px',
                background: 'var(--bg-surface)',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                  color: 'var(--color-primary)',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                }}
              >
                <Key size={32} />
              </div>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0' }}>Chave de IA Necessária</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
                Para usar os recursos de Inteligência Artificial, você precisa primeiro configurar sua chave de API
                (OpenAI, Gemini, Anthropic ou modelo local) nas configurações do sistema.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowKeyAlert(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button onClick={() => navigate('/settings')} className="btn-primary" style={{ flex: 1 }}>
                  Configurações
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <QuotaModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} />

      {toastMessage &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-primary)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-full)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 99999,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <Check size={18} /> {toastMessage}
          </div>,
          document.body,
        )}
      {isCitationModalOpen && article && (
        <CitationModal
          isOpen={isCitationModalOpen}
          onClose={() => setIsCitationModalOpen(false)}
          article={article}
          onArticleUpdated={fetchData}
        />
      )}
      {/* Floating Categories Button */}
      {id && (
        <FloatingCategoriesPanel
          articleId={parseInt(id)}
          isCategoriesOpen={isCategoriesOpen}
          setIsCategoriesOpen={setIsCategoriesOpen}
          projectCategories={projectCategories}
          articleCategories={articleCategories}
        />
      )}
    </div>
  );
};
