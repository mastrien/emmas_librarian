import React, { useState } from 'react';
import type { Article, RAGExtractionResult, SearchHistoryItem } from '../../../types';
import QuestionSetCatalog from '../../ai/QuestionSetCatalog';
import { ArticleSelector } from '../../ai/ArticleSelector';
import type { AIExtractionResult } from '../AIExtractionModal';
import { QuestionListEditor } from './QuestionListEditor';
import { ExtractionRunControls } from './ExtractionRunControls';
import { ExtractionResultList } from './ExtractionResultList';

interface NewInvestigationPanelProps {
  articlesWithPdf: Article[];
  searchHistory: SearchHistoryItem[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  questions: string[];
  setQuestions: (questions: string[]) => void;
  isExtracting: boolean;
  progress: { current: number; total: number };
  results: AIExtractionResult[];
  onStart: (selectedIds: number[]) => void;
  onCancel: () => void;
  onFinish: () => void;
  onViewEvidence: (articleId: number, evidence: RAGExtractionResult['evidences'][0]) => void;
}

const surfaceStyle: React.CSSProperties = {
  padding: '1rem',
  background: 'var(--bg-surface)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
};

/**
 * Pick articles and questions, run the investigation and read its results.
 *
 * Usage:
 *   <NewInvestigationPanel articlesWithPdf={articles} questions={qs} setQuestions={setQs} ... />
 */
export const NewInvestigationPanel: React.FC<NewInvestigationPanelProps> = (props) => {
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const { articlesWithPdf, questions, isExtracting, results } = props;
  if (articlesWithPdf.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
        Nenhum artigo com PDF vinculado encontrado neste projeto.
      </div>
    );
  }
  const isFinished = !isExtracting && results.length > 0;
  const locked = isExtracting || isFinished;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={surfaceStyle}>
        <div style={{ marginBottom: '1.25rem' }}>
          <ArticleSelector
            articles={articlesWithPdf}
            selectedIds={props.selectedIds}
            setSelectedIds={props.setSelectedIds}
            searchHistory={props.searchHistory}
            disabled={locked}
          />
        </div>
        <QuestionListEditor
          questions={questions}
          locked={locked}
          onChange={props.setQuestions}
          onSaveAsSet={() => setIsCreatingSet(true)}
        />
        {!locked && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <QuestionSetCatalog
              projectId={articlesWithPdf[0]?.project_id || null}
              currentQuestions={questions}
              onSelectSet={props.setQuestions}
              isCreatingExternal={isCreatingSet}
              onCancelCreateExternal={() => setIsCreatingSet(false)}
            />
          </div>
        )}
      </div>
      <ExtractionRunControls
        isExtracting={isExtracting}
        isFinished={isFinished}
        canStart={props.selectedIds.length > 0 && questions.some((q) => q.trim())}
        progress={props.progress}
        onStart={() => props.onStart(props.selectedIds)}
        onCancel={props.onCancel}
        onFinish={props.onFinish}
      />
      <ExtractionResultList results={results} onViewEvidence={props.onViewEvidence} />
    </div>
  );
};
