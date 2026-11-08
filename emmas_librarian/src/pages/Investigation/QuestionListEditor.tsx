import React from 'react';
import { Trash2 } from 'lucide-react';

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
      <div className="inv-question-list">
        {questions.map((q, idx) => (
          <div key={idx} className="inv-question-row">
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
              className="btn-secondary inv-question-remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="inv-question-actions">
        <button onClick={() => onChange([...questions, ''])} className="btn-secondary">
          + Adicionar Pergunta
        </button>
        <button
          className="btn-secondary"
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
