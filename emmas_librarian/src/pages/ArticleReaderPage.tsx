import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
pdfjs.GlobalWorkerOptions.standardFontDataUrl = 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/';

import { projectService } from '../services/api';
import { PdfPlaceholderView } from '../components/reader/PdfPlaceholderView';

import { useArticleData } from './ArticleReader/hooks/useArticleData';
import { usePdfAnnotations } from './ArticleReader/hooks/usePdfAnnotations';
import { usePdfZoom } from './ArticleReader/hooks/usePdfZoom';
import { usePdfSearch } from './ArticleReader/hooks/usePdfSearch';

import { ArticleReaderToolbar } from './ArticleReader/components/ArticleReaderToolbar';
import { ArticleReaderModals } from './ArticleReader/components/ArticleReaderModals';
import { ArticleReaderPdfView } from './ArticleReader/components/ArticleReaderPdfView';

export const ArticleReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Toolbars and Modals State
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [showKeyAlert, setShowKeyAlert] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('emma_sidebar_width') || '320', 10);
  });
  const isDraggingSidebar = useRef(false);
  const [sidebarTab, setSidebarTab] = useState<'annotations' | 'search' | 'ai' | 'writer'>('annotations');

  // Page State
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState('1');
  const highlighterRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Hooks
  const {
    highlights,
    setHighlights,
    standaloneAnnotations,
    setStandaloneAnnotations,
    newAnnotationText,
    setNewAnnotationText,
    editingId,
    setEditingId,
    editContent,
    setEditContent,
    anchoringStatus,
    setAnchoringStatus,
    addHighlight,
    handleCreateStandaloneAnnotation,
    handleDeleteHighlight,
    handleDeleteStandaloneAnnotation,
    handleEditHighlightAnnotation,
    handleEditStandaloneAnnotation,
    saveEdit,
  } = usePdfAnnotations(id);

  const {
    article,
    loading,
    uploading,
    pdfUrl,
    projectCategories,
    articleCategories,
    writingPadContent,
    setWritingPadContent,
    aiSummary,
    setAiSummary,
    hasAiKey,
    fetchData,
    fetchCategories,
    handleFileUpload,
    handleUnlinkClick,
  } = useArticleData(id, setHighlights as any, setStandaloneAnnotations, setAnchoringStatus);

  const { scale, handleZoom } = usePdfZoom(highlighterRef);
  const { searchQuery, setSearchQuery, searchResults, isSearching } = usePdfSearch(
    sidebarTab,
    highlighterRef,
    setCurrentPage,
    setInputPage,
  );

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Sidebar Dragging Logic
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

  // Scroll Tracking Logic
  useEffect(() => {
    let scrollTimeout: number | NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
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
      }, 50);
    };
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
          boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1 },
        },
      });
      setCurrentPage(pageNum);
      setInputPage(pageNum.toString());
    }
  };

  const handlePadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setWritingPadContent(val);
    if (article?.project_id) {
      projectService.updateProjectWritingPad(article.project_id, val).catch((error) => {
        console.error('Erro ao salvar rascunho:', error);
      });
    }
  };

  const handleEditMetadataSubmit = async (data: Record<string, unknown>) => {
    if (!article) return;
    await projectService.updateArticleMetadata(article.id, data);
    await fetchData();
  };

  const generateSummary = async () => {
    if (!hasAiKey) {
      setShowKeyAlert(true);
      return;
    }
    if (!pdfUrl || !id) return;
    setIsGeneratingAi(true);
    try {
      const resp = await projectService.generateSummary(parseInt(id));
      if (resp) {
        setAiSummary({
          generalSummary: resp.generalSummary?.replace(/\\n/g, '\n') || '',
          sectionSummary: resp.sectionSummary?.replace(/\\n/g, '\n') || '',
        });
      }
    } catch (err: any) {
      if (err.message?.includes('QUOTA_EXCEEDED')) {
        setShowQuotaModal(true);
      } else {
        alert('Erro ao gerar resumo da IA.');
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando Leitor...</div>;
  if (!article) return <div style={{ textAlign: 'center', padding: '2rem' }}>Artigo não encontrado.</div>;

  const hasLocalFile = !!article.local_file_path;

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
      <ArticleReaderToolbar
        article={article}
        hasLocalFile={hasLocalFile}
        uploading={uploading}
        scale={scale}
        handleZoom={handleZoom}
        handleFileUpload={handleFileUpload}
        handleUnlinkClick={handleUnlinkClick}
        setIsEditingMetadata={setIsEditingMetadata}
        setIsCitationModalOpen={setIsCitationModalOpen}
      />

      <div style={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
        {!hasLocalFile && article ? (
          <PdfPlaceholderView
            article={article}
            uploading={uploading}
            onFileUpload={() => setIsAttachModalOpen(true)}
          />
        ) : (
          <ArticleReaderPdfView
            pdfUrl={pdfUrl || ''}
            pdfWorkerUrl={pdfWorkerUrl}
            scale={scale}
            highlighterRef={highlighterRef}
            highlights={highlights}
            addHighlight={addHighlight}
            showToast={showToast}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            inputPage={inputPage}
            setInputPage={setInputPage}
            goToPage={goToPage}
            sidebarWidth={sidebarWidth}
            isDraggingSidebar={isDraggingSidebar}
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            aiSummary={aiSummary}
            isGeneratingAi={isGeneratingAi}
            generateSummary={generateSummary}
            standaloneAnnotations={standaloneAnnotations}
            newAnnotationText={newAnnotationText}
            setNewAnnotationText={setNewAnnotationText}
            handleCreateStandaloneAnnotation={handleCreateStandaloneAnnotation}
            handleDeleteHighlight={handleDeleteHighlight}
            handleDeleteStandaloneAnnotation={handleDeleteStandaloneAnnotation}
            handleEditHighlightAnnotation={handleEditHighlightAnnotation}
            handleEditStandaloneAnnotation={handleEditStandaloneAnnotation}
            editingId={editingId}
            editContent={editContent}
            setEditContent={setEditContent}
            saveEdit={saveEdit}
            setEditingId={setEditingId}
          />
        )}
      </div>

      <ArticleReaderModals
        id={id}
        article={article}
        isEditingMetadata={isEditingMetadata}
        setIsEditingMetadata={setIsEditingMetadata}
        handleEditMetadataSubmit={handleEditMetadataSubmit}
        showKeyAlert={showKeyAlert}
        setShowKeyAlert={setShowKeyAlert}
        showQuotaModal={showQuotaModal}
        setShowQuotaModal={setShowQuotaModal}
        toastMessage={toastMessage}
        isCitationModalOpen={isCitationModalOpen}
        setIsCitationModalOpen={setIsCitationModalOpen}
        fetchData={fetchData}
        isCategoriesOpen={isCategoriesOpen}
        setIsCategoriesOpen={setIsCategoriesOpen}
        projectCategories={projectCategories}
        articleCategories={articleCategories}
        isAttachModalOpen={isAttachModalOpen}
        setIsAttachModalOpen={setIsAttachModalOpen}
      />
    </div>
  );
};
