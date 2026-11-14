import React from 'react';
import { Plus, X } from 'lucide-react';

interface QuestionListEditorProps {
  questions: string[];
  onChange: (questions: string[]) => void;
  onSaveAsSet: () => void;
}

const filled = (questions: string[]) => questions.filter((q) => q.trim().length > 0);

/**
 * The investigation's questions: editable inputs with add, remove and save as a set.
 *
 * Usage:
 *   <QuestionListEditor questions={questions} onChange={setQuestions} onSaveAsSet={openCreateSet} />
 */
export const QuestionListEditor: React.FC<QuestionListEditorProps> = ({ questions, onChange, onSaveAsSet }) => {
  const update = (index: number, value: string) => onChange(questions.map((q, i) => (i === index ? value : q)));
  // An empty list would hide the inputs entirely, so the last removal leaves one blank question.
  const remove = (index: number) => {
    const remaining = questions.filter((_, i) => i !== index);
    onChange(remaining.length ? remaining : ['']);
  };
  const canSave = filled(questions).length > 0;
  return (
    <>
      <div className="inv-question-editor">
        <div className="inv-question-row inv-question-row--head" aria-hidden="true">
          <span />
          <span className="inv-section-title">Pergunta</span>
          <span />
        </div>
        {questions.map((q, idx) => (
          <div key={idx} className="inv-question-row">
            <span className="inv-question-index">P{idx + 1}</span>
            <input
              type="text"
              value={q}
              onChange={(e) => update(idx, e.target.value)}
              className="input-field"
              placeholder={`Pergunta ${idx + 1}`}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label={`Remover a pergunta ${idx + 1}`}
              className="btn-ghost inv-question-remove"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="inv-question-actions">
        <button type="button" onClick={() => onChange([...questions, ''])} className="btn-ghost">
          <Plus size={14} aria-hidden="true" /> Pergunta
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onSaveAsSet}
          disabled={!canSave}
          title={canSave ? 'Salvar perguntas atuais como novo conjunto' : 'Adicione perguntas acima para salvar'}
        >
          + Salvar Atual
        </button>
      </div>
    </>
  );
};
