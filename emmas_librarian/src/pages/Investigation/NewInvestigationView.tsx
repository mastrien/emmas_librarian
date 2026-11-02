import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArticleSelector } from '../../components/ai/ArticleSelector';
import QuestionSetCatalog from '../../components/ai/QuestionSetCatalog';
import type { Article, SearchHistoryItem } from '../../types';
import { QuestionListEditor } from './QuestionListEditor';

/** What the next investigation will run. */
export interface InvestigationDraft {
  questions: string[];
  selectedIds: number[];
}

interface NewInvestigationViewProps {
  projectId: number;
  articlesWithPdf: Article[];
  searchHistory: SearchHistoryItem[];
  draft: InvestigationDraft;
  onDraftChange: (draft: InvestigationDraft) => void;
  modelLabel: string;
  /** One run at a time: another one in progress keeps this from starting. */
  busy: boolean;
  onStart: () => void;
  onCancel: () => void;
}

/**
 * The setup of a new investigation: questions and articles side by side, and a bar that says, before it runs, how
 * many answers will be asked of which model (a wrong provider once went unnoticed until every call failed).
 *
 * @example <NewInvestigationView projectId={3} articlesWithPdf={a} searchHistory={h} draft={d} onDraftChange={setD} modelLabel="Ollama" busy={false} onStart={go} onCancel={back} />
 */
export const NewInvestigationView: React.FC<NewInvestigationViewProps> = (props) => {
  const { projectId, articlesWithPdf, searchHistory, draft, onDraftChange, modelLabel, busy, onStart, onCancel } =
    props;
  const [creatingSet, setCreatingSet] = useState(false);
  const questions = draft.questions.filter((q) => q.trim()).length;
  const articles = draft.selectedIds.length;
  const setQuestions = (next: string[]) => onDraftChange({ ...draft, questions: next });
  return (
    <div className="inv-scroll">
      <div className="inv-detail-head">
        <div>
          <h2>Nova investigação</h2>
          <div className="inv-muted">As mesmas perguntas vão para cada artigo escolhido.</div>
        </div>
        <button type="button" className="btn-secondary inv-small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {articlesWithPdf.length === 0 ? (
        <div className="inv-empty">Nenhum artigo com PDF vinculado encontrado neste projeto.</div>
      ) : (
        <>
          <div className="inv-new-grid">
            <section className="inv-card" aria-label="Perguntas">
              <h3 className="inv-section-title">Perguntas ({questions})</h3>
              <QuestionListEditor
                questions={draft.questions}
                onChange={setQuestions}
                onSaveAsSet={() => setCreatingSet(true)}
              />
              <div className="inv-divider">
                <QuestionSetCatalog
                  projectId={projectId}
                  currentQuestions={draft.questions}
                  onSelectSet={setQuestions}
                  isCreatingExternal={creatingSet}
                  onCancelCreateExternal={() => setCreatingSet(false)}
                />
              </div>
            </section>
            <section className="inv-card" aria-label="Artigos com PDF">
              <h3 className="inv-section-title">Artigos com PDF</h3>
              <ArticleSelector
                articles={articlesWithPdf}
                selectedIds={draft.selectedIds}
                setSelectedIds={(selectedIds) => onDraftChange({ ...draft, selectedIds })}
                searchHistory={searchHistory}
                disabled={false}
              />
            </section>
          </div>
          <div className="inv-run-bar">
            <span>
              <strong>
                {articles} artigos × {questions} perguntas = {articles * questions} respostas
              </strong>
              <br />
              <span className="inv-muted">
                {busy ? 'Já há uma investigação em andamento; espere ela terminar.' : `Modelo: ${modelLabel} · `}
                {!busy && <Link to="/settings">trocar em Configurações</Link>}
              </span>
            </span>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || articles === 0 || questions === 0}
              onClick={onStart}
            >
              Iniciar investigação
            </button>
          </div>
        </>
      )}
    </div>
  );
};
