import React, { useState } from 'react';
import QuestionSetCatalog from '../../components/ai/QuestionSetCatalog';
import type { InvestigationHistoryRecord } from '../../types';
import { parseJsonList } from '../../utils/parseJsonList';
import { QuestionListEditor } from './QuestionListEditor';

interface QuestionsStepProps {
  projectId: number;
  questions: string[];
  onChange: (questions: string[]) => void;
  /** The newest investigation, offered as a starting point. */
  lastInvestigation?: InvestigationHistoryRecord;
}

const StartCard: React.FC<{ title: string; note: string; onPick: () => void }> = ({ title, note, onPick }) => (
  <button type="button" className="inv-start-card" onClick={onPick}>
    <span className="inv-start-card__title">{title}</span>
    <span className="inv-muted">{note}</span>
  </button>
);

/**
 * Step 1 of a new investigation (board 159): where the questions start from (the last investigation, nothing, or a
 * saved set), then the questions themselves.
 *
 * @example <QuestionsStep projectId={3} questions={q} onChange={setQ} lastInvestigation={history[0]} />
 */
export const QuestionsStep: React.FC<QuestionsStepProps> = ({ projectId, questions, onChange, lastInvestigation }) => {
  const [creatingSet, setCreatingSet] = useState(false);
  const lastQuestions = lastInvestigation ? parseJsonList<string>(lastInvestigation.questions) : [];
  return (
    <div className="inv-step-body">
      <section className="inv-start" aria-label="Começar de">
        <span className="inv-section-title">Começar de</span>
        <div className="inv-start-grid">
          {lastInvestigation && lastQuestions.length > 0 && (
            <StartCard
              title={`Da investigação #${lastInvestigation.id}`}
              note={`${lastQuestions.length} perguntas`}
              onPick={() => onChange(lastQuestions)}
            />
          )}
          <StartCard title="Do zero" note="Escreva as suas perguntas" onPick={() => onChange([''])} />
        </div>
      </section>
      <section className="inv-card" aria-label="Perguntas">
        <h3 className="inv-section-title">Perguntas</h3>
        <QuestionListEditor questions={questions} onChange={onChange} onSaveAsSet={() => setCreatingSet(true)} />
        <div className="inv-divider">
          <QuestionSetCatalog
            projectId={projectId}
            currentQuestions={questions}
            onSelectSet={onChange}
            isCreatingExternal={creatingSet}
            onCancelCreateExternal={() => setCreatingSet(false)}
          />
        </div>
      </section>
    </div>
  );
};
