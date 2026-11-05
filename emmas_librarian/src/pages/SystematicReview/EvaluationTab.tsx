import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectService } from '../../contexts/ServicesContext';
import { describeError } from '../../utils/describeError';
import type { Article, ScreeningSuggestion } from '../../types';
import { criteriaSnapshot, hasCriteria, providerName } from '../../utils/screeningCriteria';
import { evaluateEngines, rateText, sampleArticles, type EngineEvaluation } from '../../utils/screeningEvaluation';
import { decisionAt } from '../../utils/screeningView';
import { CriteriaModal } from './CriteriaModal';
import { useScreeningEvaluation } from './useScreeningEvaluation';
import { useScreeningSuggestions } from './useScreeningSuggestions';
import type { ScreeningState } from './useScreening';

const SAMPLE_SIZE = 50;

const seconds = (ms: number) => `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;

const EnginesTable: React.FC<{ evaluations: EngineEvaluation[] }> = ({ evaluations }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className="review-table">
      <thead>
        <tr>
          <th scope="col">Motor</th>
          <th scope="col">Recall dos relevantes</th>
          <th scope="col">Precisão</th>
          <th scope="col">Acerto</th>
          <th scope="col">Tokens (estimados)</th>
          <th scope="col">Tempo por artigo</th>
        </tr>
      </thead>
      <tbody>
        {evaluations.map((e) => (
          <tr key={e.engine}>
            <td>{e.engine}</td>
            <td>
              <strong>{rateText(e.recall)}</strong>
            </td>
            <td>{rateText(e.precision)}</td>
            <td>{rateText(e.agreement)}</td>
            <td>{e.tokensEstimated.toLocaleString('pt-BR')}</td>
            <td>{seconds(e.meanElapsedMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MissedList: React.FC<{ evaluation: EngineEvaluation; articles: Article[] }> = ({ evaluation, articles }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <h3 style={{ margin: 0 }}>Relevantes que o motor excluiria ({evaluation.missed.length})</h3>
    <p className="review-muted" style={{ margin: 0 }}>
      É o erro caro. A lista mostra quais foram, para você julgar se a perda é aceitável.
    </p>
    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {evaluation.missed.map((m) => (
        <li key={m.articleId} style={{ overflowWrap: 'anywhere' }}>
          {articles.find((a) => a.id === m.articleId)?.title}{' '}
          <span className="review-muted">
            (você: {m.personLabel}; IA: {m.engineLabel})
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const CalibrationTable: React.FC<{ evaluation: EngineEvaluation }> = ({ evaluation }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <h3 style={{ margin: 0 }}>A confiança da IA vale alguma coisa?</h3>
    <div style={{ overflowX: 'auto' }}>
      <table className="review-table">
        <thead>
          <tr>
            <th scope="col">Confiança declarada</th>
            <th scope="col">Artigos</th>
            <th scope="col">Acertou</th>
          </tr>
        </thead>
        <tbody>
          {evaluation.calibration.map((band) => (
            <tr key={band.name}>
              <td>{band.name}</td>
              <td>{band.articles}</td>
              <td>{rateText({ hits: band.agreed, total: band.articles })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// With few relevant articles the main measure swings a lot, and the person should know it before trusting it.
const SmallSampleNote: React.FC<{ evaluation: EngineEvaluation }> = ({ evaluation: { recall } }) =>
  recall.total > 0 && recall.total < 30 ? (
    <p className="review-muted" role="note" style={{ margin: 0 }}>
      Com {recall.total} relevantes, cada erro muda o recall em {(100 / recall.total).toFixed(1).replace('.', ',')}{' '}
      pontos. Trate o número como uma indicação.
    </p>
  ) : null;

/**
 * The local classifier as one more engine in the table (#54). It needs no criteria and calls no provider. Each article
 * is judged by a round that did not learn from it, or it would look far better than it is.
 */
const ClassifierEvaluation: React.FC<{ projectId: number; onDone: (suggestions: ScreeningSuggestion[]) => void }> = ({
  projectId,
  onDone,
}) => {
  const service = useProjectService();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const evaluate = async () => {
    setRunning(true);
    try {
      const saved = await service.evaluateClassifier(projectId);
      onDone(saved);
      setOutcome(
        saved.length === 0
          ? 'Ainda não dá para medir: é preciso ter vetores de artigos decididos, com ao menos 3 relevantes e 3 excluídos. Os vetores são gerados na simulação, abaixo.'
          : null,
      );
    } catch (err) {
      setOutcome(describeError(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <p className="review-muted" style={{ margin: 0, maxWidth: '72ch' }}>
        O classificador local aprende com as suas decisões e roda neste computador, sem consumir tokens. Cada artigo é
        julgado por uma rodada que não aprendeu com ele. Ele não escreve justificativa, então por enquanto só aparece
        aqui, para comparar.
      </p>
      <button type="button" className="review-small" disabled={running} onClick={() => void evaluate()}>
        {running ? 'Medindo…' : 'Medir o classificador local'}
      </button>
      {outcome && (
        <p role="note" style={{ margin: 0 }}>
          {outcome}
        </p>
      )}
    </div>
  );
};

/** Who can be measured: decided at title and abstract, not a duplicate, and with an abstract to read. */
function articlesToEvaluate(screening: ScreeningState): number[] {
  return screening.articles
    .filter((article) => {
      const decision = decisionAt(screening.decisions, article.id, 'title');
      const kind = screening.labels.find((label) => label.id === decision?.label_id)?.kind;
      return kind !== undefined && kind !== 'removed' && !!article.abstract?.trim();
    })
    .map((article) => article.id);
}

/**
 * Compares the engines with the decisions already made in a project (#54), so trusting one comes from measuring it here
 * and not from what is said about it. The engines never see those decisions.
 *
 * @example <EvaluationTab projectId={3} screening={screening} />
 */
export const EvaluationTab: React.FC<{ projectId: number; screening: ScreeningState }> = ({ projectId, screening }) => {
  const suggestions = useScreeningSuggestions(projectId);
  const evaluation = useScreeningEvaluation(suggestions.keep);
  const [sampled, setSampled] = useState(false);
  const [writing, setWriting] = useState(false);
  const { engine, criteria } = suggestions;

  const eligible = articlesToEvaluate(screening);
  const chosen = sampled ? sampleArticles(eligible, SAMPLE_SIZE, projectId) : eligible;
  const snapshot = criteriaSnapshot(criteria);
  const pending = chosen.filter((id) => {
    const kept = suggestions.forArticle(id);
    return kept?.criteria !== snapshot;
  });
  const evaluations = evaluateEngines({
    decisions: screening.decisions,
    labels: screening.labels,
    suggestions: suggestions.suggestions,
    criteria: snapshot,
  });
  const current = evaluations.find((e) => e.engine === engine?.id) ?? evaluations[0];

  return (
    <section className="review-section review-evaluation" aria-label="Avaliar sugestões">
      <p style={{ margin: 0, maxWidth: '72ch' }}>
        Compara os motores com as suas decisões de título e resumo. A IA não vê essas decisões, só título, resumo e
        critérios. Para comparar outro motor, troque o modelo em <Link to="/settings">Configurações</Link> e avalie de
        novo: os resultados ficam lado a lado.
      </p>
      {eligible.length === 0 && (
        <p className="review-muted" style={{ margin: 0 }}>
          Decida alguns artigos com resumo na triagem para poder avaliar.
        </p>
      )}
      {!hasCriteria(criteria) && (
        <button type="button" className="review-link" onClick={() => setWriting(true)}>
          Escrever os critérios do projeto
        </button>
      )}
      {eligible.length > 0 && hasCriteria(criteria) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <span>
            Motor: <strong>{engine?.id}</strong>
          </span>
          <label className="review-field">
            <span>Artigos</span>
            <select
              className="input-field"
              value={sampled ? 'sample' : 'all'}
              onChange={(e) => setSampled(e.target.value === 'sample')}
            >
              <option value="all">{eligible.length} já triados (todos)</option>
              {eligible.length > SAMPLE_SIZE && <option value="sample">Amostra de {SAMPLE_SIZE}</option>}
            </select>
          </label>
          {evaluation.progress ? (
            <button type="button" className="btn-secondary" onClick={evaluation.stop}>
              Parar
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={pending.length === 0}
              onClick={() => void evaluation.run(pending)}
            >
              Avaliar
            </button>
          )}
        </div>
      )}
      {evaluation.progress && (
        <p role="status" style={{ margin: 0 }}>
          Avaliando {evaluation.progress.done + 1} de {evaluation.progress.total}…
        </p>
      )}
      {!evaluation.progress && pending.length > 0 && engine && hasCriteria(criteria) && (
        <p className="review-suggestion review-suggestion--warn" style={{ margin: 0 }}>
          Envia título, resumo e critérios de {pending.length} artigos para {providerName(engine.provider)}. Isso
          consome tokens. Os já avaliados com este motor e estes critérios não são pagos de novo.
        </p>
      )}
      {evaluation.problem && (
        <p role="alert" style={{ margin: 0 }}>
          {evaluation.problem}
        </p>
      )}
      <ClassifierEvaluation projectId={projectId} onDone={(saved) => saved.forEach(suggestions.keep)} />
      {evaluations.length > 0 && <EnginesTable evaluations={evaluations} />}
      {current && <SmallSampleNote evaluation={current} />}
      {current && current.missed.length > 0 && <MissedList evaluation={current} articles={screening.articles} />}
      {current && <CalibrationTable evaluation={current} />}
      {writing && (
        <CriteriaModal projectId={projectId} onClose={() => setWriting(false)} onSaved={suggestions.setCriteria} />
      )}
    </section>
  );
};
