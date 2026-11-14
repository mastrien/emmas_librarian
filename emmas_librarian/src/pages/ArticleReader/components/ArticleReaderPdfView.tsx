import React, { useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { PdfLoader, PdfHighlighter, Highlight, Popup, AreaHighlight } from 'react-pdf-highlighter';

import { TipContent } from '../../../components/reader/TipContent';
import type { PdfDocumentProxy } from '../hooks/usePdfSearch';
import { ReaderSidebar } from '../../../components/reader/ReaderSidebar';
import { Annotation } from '../../../types';

import type { Highlight as AppHighlight } from '../../../types';
import { scrollViewerTo } from '../viewerHighlight';

interface ArticleReaderPdfViewProps {
  pdfUrl: string;
  pdfWorkerUrl: string;
  scale: number;
  highlighterRef: React.MutableRefObject<any>;
  highlights: any[];
  addHighlight: (h: any) => void;
  showToast: (msg: string) => void;
  goToPage: (pageNum: number) => void;
  /** Tells the page how many pages the PDF has, for the bar's page navigation. */
  onDocumentReady: (numPages: number) => void;
  /** The colour a new highlight starts with, chosen on the bar. */
  highlightColor: string;
  sidebarOpen: boolean;
  sidebarWidth: number;
  isDraggingSidebar: React.MutableRefObject<boolean>;
  sidebarTab: 'annotations' | 'search' | 'ai' | 'writer';
  setSidebarTab: React.Dispatch<React.SetStateAction<'annotations' | 'search' | 'ai' | 'writer'>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  isSearching: boolean;
  /** Runs the in-PDF search over the loaded document. */
  onSearch: (pdfDocument: PdfDocumentProxy) => void;
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
  handleRetryAnchor: (a: Annotation) => Promise<void>;
  editingId: string | null;
  editContent: string;
  setEditContent: (val: string) => void;
  saveEdit: (idToSave: string, annotationId: number, isStandalone: boolean) => Promise<void>;
  setEditingId: (id: string | null) => void;
  onCategorySaved?: () => void;
}

/** Reports the page count once the document is there (it is only known inside the loader). */
const DocumentReady: React.FC<{ numPages: number; onReady: (numPages: number) => void }> = ({ numPages, onReady }) => {
  useEffect(() => onReady(numPages), [numPages, onReady]);
  return null;
};

export const ArticleReaderPdfView: React.FC<ArticleReaderPdfViewProps> = ({
  pdfUrl,
  pdfWorkerUrl,
  scale,
  highlighterRef,
  highlights,
  addHighlight,
  showToast,
  goToPage,
  onDocumentReady,
  highlightColor,
  sidebarOpen,
  sidebarWidth,
  isDraggingSidebar,
  sidebarTab,
  setSidebarTab,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  onSearch,
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
  handleRetryAnchor,
  editingId,
  editContent,
  setEditContent,
  saveEdit,
  setEditingId,
}) => {
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
        initialColor={highlightColor}
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
                ref={
                  highlighterRef as React.MutableRefObject<PdfHighlighter<import('react-pdf-highlighter').IHighlight>>
                }
                pdfDocument={pdfDocument}
                pdfScaleValue={scale.toString()}
                enableAreaSelection={(event) => event.altKey}
                scrollRef={() => {}}
                onScrollChange={() => {}}
                onSelectionFinished={(position, content, hideTipAndSelection) =>
                  renderTip(position, content, hideTipAndSelection)
                }
                highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
                  const isTextHighlight = !(highlight.content && highlight.content.image);

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
                        onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
                        onMouseOut={hideTip}
                      >
                        {component}
                      </Popup>
                    </div>
                  );
                }}
                highlights={highlights as unknown as Array<import('react-pdf-highlighter').IHighlight>}
              />

              <DocumentReady numPages={pdfDocument.numPages} onReady={onDocumentReady} />
            </div>

            {sidebarOpen && (
              <ReaderSidebar
                width={sidebarWidth}
                sidebarTab={sidebarTab}
                setSidebarTab={setSidebarTab}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                isSearching={isSearching}
                onResultClick={(pageNum) => goToPage(pageNum)}
                onSearch={(e) => {
                  // The search box is a <form>; without preventDefault the submit reloaded the whole reader.
                  e.preventDefault();
                  onSearch(pdfDocument as unknown as PdfDocumentProxy);
                }}
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
                onRetryAnchor={handleRetryAnchor}
                editingId={editingId}
                editContent={editContent}
                setEditContent={setEditContent}
                onSaveEdit={saveEdit}
                setEditingId={setEditingId}
                onHighlightClick={(h) => scrollViewerTo(highlighterRef, h)}
              />
            )}

            {/* Resizer Handle */}
            {sidebarOpen && (
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
            )}
          </div>
        )}
      </PdfLoader>
    </div>
  );
};
