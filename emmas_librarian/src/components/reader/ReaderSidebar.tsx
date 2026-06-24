import React from 'react';
import { AnnotationsTab } from './AnnotationsTab';
import { SearchTab } from './SearchTab';
import { AiInsightsTab } from './AiInsightsTab';
import { Annotation } from '../../types';

interface ReaderSidebarProps {
  sidebarTab: 'annotations' | 'search' | 'ai' | 'writer';
  setSidebarTab: (tab: 'annotations' | 'search' | 'ai' | 'writer') => void;
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
    <div style={{ 
      width: `${width}px`, 
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
        <AiInsightsTab
          isGeneratingAi={isGeneratingAi}
          aiSummary={aiSummary}
          onGenerateSummary={onGenerateSummary}
        />
      )}
    </div>
  );
};
