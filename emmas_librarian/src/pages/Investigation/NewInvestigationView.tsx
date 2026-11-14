import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ArticleSelector } from '../../components/ai/ArticleSelector';
import type { Article, InvestigationHistoryRecord, SearchHistoryItem } from '../../types';
import { InvestigationStepper } from './InvestigationStepper';
import { QuestionsStep } from './QuestionsStep';
import { ModelStep, RunStep } from './RunPlanSteps';
import {
  nextStep,
  previousStep,
  stepBlocker,
  stepLabel,
  type DraftCounts,
  type NewInvestigationStep,
} from './newInvestigationSteps';

/** What the next investigation will run. */
export interface InvestigationDraft {
  questions: string[];
  selectedIds: number[];
}

interface NewInvestigationViewProps {
  projectId: number;
  articlesWithPdf: Article[];
  searchHistory: SearchHistoryItem[];
  /** The newest investigation, offered as a starting point for the questions. */
  lastInvestigation?: InvestigationHistoryRecord;
  draft: InvestigationDraft;
  onDraftChange: (draft: InvestigationDraft) => void;
  modelLabel: string;
  /** One run at a time: another one in progress keeps this from starting. */
  busy: boolean;
  onStart: () => void;
  onCancel: () => void;
}

interface StepFooterProps {
  step: NewInvestigationStep;
  counts: DraftCounts;
  busy: boolean;
  onGo: (step: NewInvestigationStep) => void;
  onStart: () => void;
  onCancel: () => void;
}

const footerNote = (step: NewInvestigationStep, counts: DraftCounts, busy: boolean): string => {
  if (busy) return 'Já há uma investigação em andamento; espere ela terminar.';
  return stepBlocker(step, counts) ?? `${counts.questions} perguntas · ${counts.articles} artigos`;
};

/** The bar under the steps: where things stand, Cancelar, Voltar and the step's one primary action. */
const StepFooter: React.FC<StepFooterProps> = ({ step, counts, busy, onGo, onStart, onCancel }) => {
  const next = nextStep(step);
  const back = previousStep(step);
  const blocked = stepBlocker(step, counts) !== null;
  return (
    <div className="inv-run-bar">
      <span className="inv-muted">{footerNote(step, counts, busy)}</span>
      <span className="inv-run-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        {back && (
          <button type="button" className="btn-secondary" onClick={() => onGo(back)}>
            Voltar
          </button>
        )}
        {next ? (
          <button type="button" className="btn-primary" disabled={blocked} onClick={() => onGo(next)}>
            Próximo: {stepLabel(next).toLowerCase()} <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={busy} onClick={onStart}>
            Iniciar investigação
          </button>
        )}
      </span>
    </div>
  );
};

/**
 * A new investigation in four steps (board 159): Perguntas, Artigos, Modelo e custo, Executar. The steps share one
 * draft, so going back loses nothing; the page's header sits above.
 *
 * @example <NewInvestigationView projectId={3} articlesWithPdf={a} searchHistory={h} draft={d} onDraftChange={setD} modelLabel="Ollama" busy={false} onStart={go} onCancel={back} />
 */
export const NewInvestigationView: React.FC<NewInvestigationViewProps> = (props) => {
  const { articlesWithPdf, draft, onDraftChange, modelLabel } = props;
  const [step, setStep] = useState<NewInvestigationStep>('questions');
  if (articlesWithPdf.length === 0) {
    return <div className="inv-empty">Nenhum artigo com PDF vinculado encontrado neste projeto.</div>;
  }
  const questions = draft.questions.filter((q) => q.trim());
  const counts = { questions: questions.length, articles: draft.selectedIds.length };
  const plan = { questions, articles: counts.articles, modelLabel };
  return (
    <div className="inv-new">
      <InvestigationStepper current={step} counts={counts} onGo={setStep} />
      <div className="inv-scroll">
        {step === 'questions' && (
          <QuestionsStep
            projectId={props.projectId}
            questions={draft.questions}
            onChange={(next) => onDraftChange({ ...draft, questions: next })}
            lastInvestigation={props.lastInvestigation}
          />
        )}
        {step === 'articles' && (
          <section className="inv-card inv-step-body" aria-label="Artigos com PDF">
            <ArticleSelector
              articles={articlesWithPdf}
              selectedIds={draft.selectedIds}
              setSelectedIds={(selectedIds) => onDraftChange({ ...draft, selectedIds })}
              searchHistory={props.searchHistory}
              disabled={false}
            />
          </section>
        )}
        {step === 'model' && <ModelStep {...plan} />}
        {step === 'run' && <RunStep {...plan} />}
      </div>
      <StepFooter
        step={step}
        counts={counts}
        busy={props.busy}
        onGo={setStep}
        onStart={props.onStart}
        onCancel={props.onCancel}
      />
    </div>
  );
};
