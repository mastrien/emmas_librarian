import React from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EvaluationChecklistProps {
  projectId: number;
  hasCriteria: boolean;
  /** Articles already decided at title and abstract, with an abstract: the gabarito of the comparison. */
  decided: number;
  /** The engine that will be measured, as its name ("ollama/llama3.1"); null until it is known. */
  engine: string | null;
  onWriteCriteria: () => void;
}

interface StepProps {
  number: number;
  done: boolean;
  title: string;
  note: React.ReactNode;
  action?: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ number, done, title, note, action }) => (
  <li className="eval-step">
    <span className={`eval-step__mark${done ? ' is-done' : ''}`} aria-hidden="true">
      {done ? <Check size={14} /> : number}
    </span>
    <div className="eval-step__text">
      <span className="eval-step__title">{title}</span>
      <span className="review-muted">{note}</span>
    </div>
    {action}
    <span className="visually-hidden">{done ? 'Pronto' : 'Falta'}</span>
  </li>
);

/**
 * How many of the three things the comparison needs are ready: the criteria, some decided articles and the engine.
 *
 * @example readySteps({ hasCriteria: true, decided: 0, engine: 'ollama' }) // 2
 */
export function readySteps(state: Pick<EvaluationChecklistProps, 'hasCriteria' | 'decided' | 'engine'>): number {
  return [state.hasCriteria, state.decided > 0, state.engine !== null].filter(Boolean).length;
}

/**
 * What is missing before the evaluation can run (board 167): the criteria the AI reads, a few decided articles to
 * compare with, and the engine, each with the way to get it done.
 *
 * @example <EvaluationChecklist projectId={3} hasCriteria decided={12} engine="ollama" onWriteCriteria={open} />
 */
export const EvaluationChecklist: React.FC<EvaluationChecklistProps> = (props) => {
  const { projectId, hasCriteria, decided, engine, onWriteCriteria } = props;
  return (
    <section className="eval-checklist" aria-label="O que falta para avaliar">
      <div className="eval-checklist__head">
        <span className="eval-checklist__title">Comparar com as suas decisões</span>
        <span className="review-muted">{readySteps(props)} de 3 pronto</span>
      </div>
      <ol className="eval-steps">
        <Step
          number={1}
          done={hasCriteria}
          title="Critérios do projeto"
          note="É o que a IA usa para sugerir incluir ou excluir."
          action={
            <button type="button" className={hasCriteria ? 'review-small' : 'btn-primary'} onClick={onWriteCriteria}>
              {hasCriteria ? 'Editar critérios' : 'Escrever os critérios do projeto'}
            </button>
          }
        />
        <Step
          number={2}
          done={decided > 0}
          title="Decida alguns artigos com resumo na triagem"
          note={`Na triagem por título e resumo. Cada decisão vira gabarito. ${decided} decididos.`}
          action={
            <Link to={`/projects/${projectId}/review`} className="review-small">
              Abrir triagem
            </Link>
          }
        />
        <Step
          number={3}
          done={engine !== null}
          title="Motor escolhido"
          note={
            <>
              {engine ? `${engine} · ` : ''}
              <Link to="/settings/ai">trocar em Configurações</Link>
            </>
          }
        />
      </ol>
    </section>
  );
};
