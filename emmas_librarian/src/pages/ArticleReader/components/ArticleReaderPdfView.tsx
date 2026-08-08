import React from 'react';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { PdfLoader, PdfHighlighter, Highlight, Popup, AreaHighlight } from 'react-pdf-highlighter';

// @ts-ignore
import * as pdfjs from 'pdfjs-dist/build/pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { TipContent } from '../../../components/reader/TipContent';
import { ReaderSidebar } from '../../../components/reader/ReaderSidebar';
import { Annotation } from '../../../types';

import type { Highlight as AppHighlight } from '../../../types';

interface ArticleReaderPdfViewProps {
  pdfUrl: string;
  pdfWorkerUrl: string;
  scale: number;
  highlighterRef: React.MutableRefObject<any>;
  highlights: any[];
  addHighlight: (h: any) => void;
  showToast: (msg: string) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  inputPage: string;
  setInputPage: React.Dispatch<React.SetStateAction<string>>;
  goToPage: (pageNum: number) => void;
  sidebarWidth: number;
  isDraggingSidebar: React.MutableRefObject<boolean>;
  sidebarTab: 'annotations' | 'search' | 'ai' | 'writer';
  setSidebarTab: React.Dispatch<React.SetStateAction<'annotations' | 'search' | 'ai' | 'writer'>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  isSearching: boolean;
  aiSummary: { generalSummary: string; sectionSummary: string } | null;
  isGeneratingAi: boolean;
  generateSummary: () => void;
  standaloneAnnotations: any[];
  newAnnotationText: string;
  setNewAnnotationText: (text: string) => void;
  handleCreateStandaloneAnnotation: () => void;
  handleDeleteHighlight: (highlightId: string, e: React.MouseEvent) => Promise<void>;
  handleDeleteStandaloneAnnotation: (annId: string) => Promise<void>;
  handleEditHighlightAnnotation: (h: any, e: React.MouseEvent) => Promise<void>;
  handleEditStandaloneAnnotation: (a: Annotation) => Promise<void>;
  editingId: string | null;
  editContent: string;
  setEditContent: (val: string) => void;
  saveEdit: (idToSave: string, annotationId: number, isStandalone: boolean) => Promise<void>;
  setEditingId: (id: string | null) => void;
  onCategorySaved?: () => void;
}

export const ArticleReaderPdfView: React.FC<ArticleReaderPdfViewProps> = ({
  pdfUrl,
  pdfWorkerUrl,
  scale,
  highlighterRef,
  highlights,
  addHighlight,
  showToast,
  currentPage,
  setCurrentPage,
  inputPage,
  setInputPage,
  goToPage,
  sidebarWidth,
  isDraggingSidebar,
  sidebarTab,
  setSidebarTab,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  aiSummary,
  isGeneratingAi,
  generateSummary,
  standaloneAnnotations,
  newAnnotationText,
  setNewAnnotationText,
  handleCreateStandaloneAnnotation,
  handleDeleteHighlight,
  handleDeleteStandaloneAnnotation,
  handleEditHighlightAnnotation,
  handleEditStandaloneAnnotation,
  editingId,
  editContent,
  setEditContent,
  saveEdit,
  setEditingId,
}) => {
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
                ref={highlighterRef as React.MutableRefObject<PdfHighlighter<import('react-pdf-highlighter').IHighlight>>}
                pdfDocument={pdfDocument}
                pdfScaleValue={scale.toString()}
                enableAreaSelection={(event) => event.altKey}
                scrollRef={() => {}}
                onScrollChange={() => {}}
                onSelectionFinished={(position, content, hideTipAndSelection) =>
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
                  bottom: '1rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bg-surface)',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  zIndex: 10,
                  border: '1px solid var(--border-color)',
                }}
              >
                <button
                  onClick={() => goToPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pág</span>
                <input
                  type="text"
                  value={inputPage}
                  onChange={(e) => setInputPage(e.target.value)}
                  onBlur={() => setInputPage(currentPage.toString())}
                  onKeyDown={(e) => handlePageInputSubmit(e, pdfDocument.numPages)}
                  style={{
                    width: '40px',
                    textAlign: 'center',
                    padding: '0.2rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>de {pdfDocument.numPages}</span>
                <button
                  onClick={() => goToPage(Math.min(pdfDocument.numPages, currentPage + 1))}
                  disabled={currentPage >= pdfDocument.numPages}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: currentPage >= pdfDocument.numPages ? 'var(--text-muted)' : 'var(--text-main)',
                    cursor: currentPage >= pdfDocument.numPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <ReaderSidebar
              width={sidebarWidth}
              sidebarTab={sidebarTab}
              setSidebarTab={setSidebarTab}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              isSearching={isSearching}
              onResultClick={(pageNum) => goToPage(pageNum)}
              onSearch={() => {}}
              aiSummary={aiSummary}
              isGeneratingAi={isGeneratingAi}
              onGenerateSummary={generateSummary}
              highlights={highlights}
              standaloneAnnotations={standaloneAnnotations}
              newAnnotationText={newAnnotationText}
              setNewAnnotationText={setNewAnnotationText}
              onCreateStandaloneAnnotation={handleCreateStandaloneAnnotation}
              onDeleteHighlight={handleDeleteHighlight}
              onDeleteStandaloneAnnotation={handleDeleteStandaloneAnnotation}
              onEditHighlightAnnotation={handleEditHighlightAnnotation}
              onEditStandaloneAnnotation={handleEditStandaloneAnnotation}
              editingId={editingId}
              editContent={editContent}
              setEditContent={setEditContent}
              onSaveEdit={saveEdit}
              setEditingId={setEditingId}
              onHighlightClick={() => {}}
            />
            
            {/* Resizer Handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingSidebar.current = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              style={{
                width: '4px',
                cursor: 'col-resize',
                position: 'absolute',
                right: `${sidebarWidth}px`,
                top: 0,
                bottom: 0,
                zIndex: 20,
                backgroundColor: isDraggingSidebar.current ? 'var(--color-primary)' : 'transparent',
              }}
            />
          </div>
        )}
      </PdfLoader>
    </div>
  );
};
