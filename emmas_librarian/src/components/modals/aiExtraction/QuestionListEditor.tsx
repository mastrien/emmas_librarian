import React from 'react';
import { Trash2 } from 'lucide-react';

interface QuestionListEditorProps {
  questions: string[];
  /** While running or after finishing, questions are listed read-only. */
  locked: boolean;
  onChange: (questions: string[]) => void;
  onSaveAsSet: () => void;
}

const filled = (questions: string[]) => questions.filter((q) => q.trim().length > 0);

/**
 * The investigation's questions: editable inputs with add/remove/save-as-set, or a read-only list once locked.
 *
 * Usage:
 *   <QuestionListEditor questions={questions} locked={false} onChange={setQuestions} onSaveAsSet={openCreateSet} />
 */
export const QuestionListEditor: React.FC<QuestionListEditorProps> = ({ questions, locked, onChange, onSaveAsSet }) => {
  if (locked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
          {filled(questions).map((q, idx) => (
            <li key={idx} style={{ marginBottom: '0.3rem' }}>
              {q}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const update = (index: number, value: string) => onChange(questions.map((q, i) => (i === index ? value : q)));
  // An empty list would hide the inputs entirely, so the last removal leaves one blank question.
  const remove = (index: number) => {
    const remaining = questions.filter((_, i) => i !== index);
    onChange(remaining.length ? remaining : ['']);
  };
  const canSave = filled(questions).length > 0;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {questions.map((q, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={q}
              onChange={(e) => update(idx, e.target.value)}
              className="input-field"
              placeholder={`Pergunta ${idx + 1}`}
              style={{ flex: 1 }}
            />
            <button
              onClick={() => remove(idx)}
              className="btn-secondary"
              style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => onChange([...questions, ''])} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
          + Adicionar Pergunta
        </button>
        <button
          className="btn-secondary"
          onClick={onSaveAsSet}
          disabled={!canSave}
          title={canSave ? 'Salvar perguntas atuais como novo conjunto' : 'Adicione perguntas acima para salvar'}
          style={{ fontSize: '0.85rem' }}
        >
          + Salvar Atual
        </button>
      </div>
    </>
  );
};
