import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X as XIcon } from 'lucide-react';
import {
  type Article,
  type InvestigationResult,
  type RAGExtractionResult as RAGExtractionResultType,
  type SearchHistoryItem,
} from '../../types';
import { InvestigationDetailView } from '../ai/InvestigationDetailView';
import { NewInvestigationPanel } from './aiExtraction/NewInvestigationPanel';
import { InvestigationHistoryList } from './aiExtraction/InvestigationHistoryList';

export interface AIExtractionResult {
  article: Article;
  result?: RAGExtractionResultType[];
  error?: string;
}

export interface InvestigationHistoryRecord {
  id: number;
  created_at: string;
  status?: string;
  model_used?: string;
  questions?: string; // JSON string
  articles_ids?: string; // JSON string
}

export interface AIExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  articlesWithPdf: Article[];
  aiQuestions: string[];
  setAiQuestions: (questions: string[]) => void;
  handleMassiveExtraction: (selectedIds: number[]) => void;
  isExtracting: boolean;
  extractionProgress: { current: number; total: number };
  aiExtractionResults: AIExtractionResult[];
  cancelExtractionRef: React.MutableRefObject<boolean>;
  investigationHistory?: InvestigationHistoryRecord[];
  searchHistory?: SearchHistoryItem[];
  articles?: Article[];
  getInvestigationResults: (investigationId: number) => Promise<InvestigationResult[]>;
}

type ExtractionTab = 'new' | 'history';

const TABS: ReadonlyArray<{ id: ExtractionTab; label: string }> = [
  { id: 'new', label: 'Nova Investigação' },
  { id: 'history', label: 'Histórico' },
];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.5rem 1rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
  color: active ? 'var(--color-primary)' : 'var(--text-muted)',
  fontWeight: active ? 600 : 400,
});

/**
 * Runs the same questions over many PDFs with the AI and browses past investigations.
 *
 * Usage:
 *   <AIExtractionModal isOpen={open} onClose={close} articlesWithPdf={withPdf} aiQuestions={qs} ... />
 */
export const AIExtractionModal = (props: AIExtractionModalProps) => {
  const { isOpen, onClose, articlesWithPdf, isExtracting, aiExtractionResults, cancelExtractionRef } = props;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ExtractionTab>('new');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InvestigationHistoryRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const hasInitializedRef = useRef(false);

  // Preselect every article with a PDF once per opening, unless a run is already shown.
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }
    if (hasInitializedRef.current || isExtracting || aiExtractionResults.length > 0) return;
    setSelectedIds(articlesWithPdf.map((a) => a.id));
    hasInitializedRef.current = true;
  }, [isOpen, isExtracting, aiExtractionResults, articlesWithPdf]);

  if (!isOpen) return null;

  // The running extraction polls this ref between articles and stops at the next one.
  const requestCancel = () => {
    cancelExtractionRef.current = true;
  };

  const switchTab = (tab: ExtractionTab) => {
    setActiveTab(tab);
    if (tab === 'new') setSelectedHistoryItem(null);
  };

  const reExecute = (questions: string[], articleIds: number[]) => {
    props.setAiQuestions(questions);
    setSelectedIds(articleIds);
    switchTab('new');
  };

  const viewEvidence = (articleId: number, evidence: RAGExtractionResultType['evidences'][0]) => {
    navigate(`/reader/${articleId}`, { state: { searchQuery: evidence.text, page: evidence.page } });
    onClose();
  };

  return createPortal(
    <div
      data-testid="ai-extraction-modal"
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
    >
      <div
        className="card fade-in"
        style={{
          padding: '2rem',
          width: '800px',
          maxWidth: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
        }}
      >
        <ExtractionModalHeader isExtracting={isExtracting} onClose={onClose} />
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => switchTab(tab.id)} style={tabStyle(activeTab === tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'new' ? (
          <NewInvestigationPanel
            articlesWithPdf={articlesWithPdf}
            searchHistory={props.searchHistory ?? []}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            questions={props.aiQuestions}
            setQuestions={props.setAiQuestions}
            isExtracting={isExtracting}
            progress={props.extractionProgress}
            results={aiExtractionResults}
            onStart={props.handleMassiveExtraction}
            onCancel={requestCancel}
            onFinish={onClose}
            onViewEvidence={viewEvidence}
          />
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingRight: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {selectedHistoryItem ? (
              <InvestigationDetailView
                investigation={selectedHistoryItem}
                articles={props.articles ?? []}
                getInvestigationResults={props.getInvestigationResults}
                onBack={() => setSelectedHistoryItem(null)}
                onReExecute={reExecute}
              />
            ) : (
              <InvestigationHistoryList
                history={props.investigationHistory ?? []}
                articles={props.articles ?? []}
                onOpen={setSelectedHistoryItem}
              />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

const ExtractionModalHeader: React.FC<{ isExtracting: boolean; onClose: () => void }> = ({ isExtracting, onClose }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
    <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      Investigação Massiva com IA
    </h3>
    <button
      type="button"
      onClick={onClose}
      disabled={isExtracting}
      title="Fechar"
      aria-label="Fechar"
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: isExtracting ? 'not-allowed' : 'pointer',
        opacity: isExtracting ? 0.5 : 1,
      }}
    >
      <XIcon size={20} />
    </button>
  </div>
);
