import { useState } from 'react';
import type { QuestionSet } from '../../types';
import { useQuestionSets } from './questionSets/useQuestionSets';
import { filledQuestions, setQuestions } from './questionSets/questionSetQueries';
import { EditSetRow, SaveSetForm, SetItem, type SetScope } from './questionSets/QuestionSetRows';
import './questionSets/questionSets.css';

interface QuestionSetCatalogProps {
  projectId: number | null;
  currentQuestions?: string[];
  onSelectSet: (questions: string[]) => void;
  isCreatingExternal?: boolean;
  onCancelCreateExternal?: () => void;
}

const SaveCurrentButton: React.FC<{ questions: string[]; onClick: () => void }> = ({ questions, onClick }) => {
  const empty = filledQuestions(questions).length === 0;
  return (
    <button
      className="btn-secondary qs-small-button"
      onClick={onClick}
      disabled={empty}
      title={empty ? 'Adicione perguntas acima para salvar' : 'Salvar perguntas atuais como novo conjunto'}
    >
      + Salvar Atual
    </button>
  );
};

const EmptyCatalog = () => (
  <div className="qs-empty">
    Nenhum conjunto de perguntas encontrado.
    <br />
    Crie perguntas acima e clique em "+ Salvar Atual" para guardá-las.
  </div>
);

/**
 * The saved question sets of the investigation page: use one, save the current questions as a new set (for this
 * project or all of them), rename, duplicate or delete. The page may own the "creating" state (isCreatingExternal).
 *
 * @example <QuestionSetCatalog projectId={4} currentQuestions={qs} onSelectSet={setQuestions} />
 */
export default function QuestionSetCatalog(props: QuestionSetCatalogProps) {
  const { projectId, currentQuestions = [], onSelectSet, isCreatingExternal, onCancelCreateExternal } = props;
  const catalog = useQuestionSets(projectId);
  const [isCreatingInternal, setIsCreatingInternal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const isCreating = isCreatingExternal ?? isCreatingInternal;
  const setIsCreating = (val: boolean) => {
    setIsCreatingInternal(val);
    if (!val && onCancelCreateExternal) onCancelCreateExternal();
  };

  const save = async (name: string, description: string, scope: SetScope) => {
    const questions = JSON.stringify(filledQuestions(currentQuestions));
    const set = {
      project_id: scope === 'global' ? null : projectId,
      name,
      description: description || null,
      questions,
    };
    if (await catalog.create(set)) setIsCreating(false);
  };

  const rename = async (set: QuestionSet, name: string, description: string) => {
    if (await catalog.update(set.id, { name, description: description || null })) setEditingId(null);
  };

  const use = (set: QuestionSet) => {
    const questions = setQuestions(set);
    if (questions) onSelectSet(questions);
    else console.error('Failed to parse question set questions:', set.id);
  };

  if (catalog.loading) return <div className="qs-loading">Carregando conjuntos...</div>;

  return (
    <div className="question-set-catalog">
      <div className="qs-head">
        <h3>Conjuntos Salvos</h3>
        {isCreatingExternal === undefined && !isCreating && (
          <SaveCurrentButton questions={currentQuestions} onClick={() => setIsCreating(true)} />
        )}
      </div>
      {isCreating && <SaveSetForm onSave={(...args) => void save(...args)} onCancel={() => setIsCreating(false)} />}
      {catalog.sets.length === 0 && !isCreating ? (
        <EmptyCatalog />
      ) : (
        <div className="catalog-list qs-list">
          {catalog.sets.map((set) =>
            editingId === set.id ? (
              <EditSetRow
                key={set.id}
                set={set}
                onSave={(name, desc) => void rename(set, name, desc)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SetItem
                key={set.id}
                set={set}
                onUse={() => use(set)}
                onEdit={() => setEditingId(set.id)}
                onDuplicate={() => void catalog.duplicate(set.id)}
                onDelete={() => void catalog.remove(set.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
