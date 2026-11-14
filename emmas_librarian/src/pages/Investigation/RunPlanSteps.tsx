import React from 'react';
import { Link } from 'react-router-dom';

interface RunPlan {
  questions: string[];
  articles: number;
  modelLabel: string;
}

const callsLine = ({ questions, articles }: RunPlan) =>
  `${articles} artigos × ${questions.length} perguntas = ${articles * questions.length} respostas`;

/**
 * Step 3 of a new investigation (board 159): which model answers and how many calls it will take, one per article
 * and question (a wrong provider once went unnoticed until every call failed).
 *
 * @example <ModelStep questions={['Q1']} articles={9} modelLabel="Ollama (gpt-oss)" />
 */
export const ModelStep: React.FC<RunPlan> = (plan) => (
  <div className="inv-step-body">
    <section className="inv-card inv-plan" aria-label="Modelo e custo">
      <span className="inv-section-title">Modelo</span>
      <span className="inv-plan__value">{plan.modelLabel}</span>
      <Link to="/settings">Trocar em Configurações</Link>
    </section>
    <section className="inv-card inv-plan" aria-label="Chamadas">
      <span className="inv-section-title">Chamadas</span>
      <span className="inv-plan__value">{callsLine(plan)}</span>
      <span className="inv-muted">
        Cada artigo recebe uma chamada por pergunta. Se algum PDF ainda não foi indexado, isso é feito antes.
      </span>
    </section>
  </div>
);

/**
 * Step 4 of a new investigation (board 159): the last look at what will run before "Iniciar investigação".
 *
 * @example <RunStep questions={['Q1']} articles={9} modelLabel="Ollama (gpt-oss)" />
 */
export const RunStep: React.FC<RunPlan> = (plan) => (
  <div className="inv-step-body">
    <section className="inv-card inv-plan" aria-label="Resumo da investigação">
      <span className="inv-plan__value">{callsLine(plan)}</span>
      <span className="inv-muted">Modelo: {plan.modelLabel}</span>
      <ol className="inv-plan__questions">
        {plan.questions.map((question, index) => (
          <li key={index}>{question}</li>
        ))}
      </ol>
      <span className="inv-muted">As respostas chegam para revisão quando a investigação terminar.</span>
    </section>
  </div>
);
