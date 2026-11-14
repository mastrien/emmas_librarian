import React from 'react';
import { AnnotationsTab } from './AnnotationsTab';
import { SearchTab } from './SearchTab';
import { AiInsightsTab } from './AiInsightsTab';
import { Annotation } from '../../types';
import { SegmentedControl, type SegmentedOption } from '../common/SegmentedControl';
import './readerSidebar.css';

type SidebarTab = 'annotations' | 'search' | 'ai' | 'writer';

const TAB_OPTIONS: SegmentedOption<SidebarTab>[] = [
  { value: 'annotations', label: 'Anotações' },
  { value: 'ai', label: 'Insights IA' },
  { value: 'search', label: 'Pesquisar' },
];

interface ReaderSidebarProps {
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  width?: number;

  // AnnotationsTab Props
  highlights: unknown[];
  standaloneAnnotations: Annotation[];
  newAnnotationText: string;
  setNewAnnotationText: (val: string) => void;
  editingId: string | null;
  setEditingId: (val: string | null) => void;
  editContent: string;
  setEditContent: (val: string) => void;
  onCreateStandaloneAnnotation: () => void;
  onDeleteHighlight: (highlightId: string, e: React.MouseEvent) => void;
  onDeleteStandaloneAnnotation: (annId: string) => void;
  onEditHighlightAnnotation: (h: unknown, e: React.MouseEvent) => void;
  onEditStandaloneAnnotation: (a: Annotation) => void;
  onRetryAnchor?: (a: Annotation) => void;
  onSaveEdit: (idToSave: string, annotationId: number, isStandalone: boolean) => void;
  onHighlightClick: (h: unknown) => void;

  // SearchTab Props
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  searchResults: Array<{ pageNumber: number; snippet: string }>;
  onSearch: (e: React.FormEvent) => void;
  onResultClick: (pageNum: number) => void;

  // AiInsightsTab Props
  isGeneratingAi: boolean;
  aiSummary: { generalSummary: string; sectionSummary: string } | null;
  onGenerateSummary: () => void;
}

export const ReaderSidebar: React.FC<ReaderSidebarProps> = ({
  sidebarTab,
  setSidebarTab,
  width = 320,

  highlights,
  standaloneAnnotations,
  newAnnotationText,
  setNewAnnotationText,
  editingId,
  setEditingId,
  editContent,
  setEditContent,
  onCreateStandaloneAnnotation,
  onDeleteHighlight,
  onDeleteStandaloneAnnotation,
  onEditHighlightAnnotation,
  onEditStandaloneAnnotation,
  onRetryAnchor,
  onSaveEdit,
  onHighlightClick,

  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  onSearch,
  onResultClick,

  isGeneratingAi,
  aiSummary,
  onGenerateSummary,
}) => {
  return (
    <div
      style={{
        width: `${width}px`,
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Board 169: the three views as one segmented control across the top of the panel. */}
      <div className="reader-tabs">
        <SegmentedControl label="Painel do leitor" value={sidebarTab} onChange={setSidebarTab} options={TAB_OPTIONS} />
      </div>

      {/* Tab Content */}
      {sidebarTab === 'annotations' && (
        <AnnotationsTab
          highlights={highlights}
          standaloneAnnotations={standaloneAnnotations}
          newAnnotationText={newAnnotationText}
          setNewAnnotationText={setNewAnnotationText}
          editingId={editingId}
          setEditingId={setEditingId}
          editContent={editContent}
          setEditContent={setEditContent}
          onCreateStandaloneAnnotation={onCreateStandaloneAnnotation}
          onDeleteHighlight={onDeleteHighlight}
          onDeleteStandaloneAnnotation={onDeleteStandaloneAnnotation}
          onEditHighlightAnnotation={onEditHighlightAnnotation}
          onEditStandaloneAnnotation={onEditStandaloneAnnotation}
          onRetryAnchor={onRetryAnchor}
          onSaveEdit={onSaveEdit}
          onHighlightClick={onHighlightClick}
        />
      )}

      {sidebarTab === 'search' && (
        <SearchTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          searchResults={searchResults}
          onSearch={onSearch}
          onResultClick={onResultClick}
        />
      )}

      {sidebarTab === 'ai' && (
        <AiInsightsTab isGeneratingAi={isGeneratingAi} aiSummary={aiSummary} onGenerateSummary={onGenerateSummary} />
      )}
    </div>
  );
};
