import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ScreeningDecision, ScreeningLabel, ScreeningRank } from '../../types';
import { embeddingModelName } from '../../utils/pdfCount';
import { describeError } from '../../utils/describeError';
import { providerName } from '../../utils/screeningCriteria';
import { recentRelevant } from '../../utils/screeningView';
import { useArticleVectors } from './useArticleVectors';

const articles = (count: number) => (count === 1 ? '1 artigo' : `${count} artigos`);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const neededText = ({ needRelevant, needExcluded }: ScreeningRank) =>
  [
    needRelevant > 0 && plural(needRelevant, 'relevante', 'relevantes'),
    needExcluded > 0 && plural(needExcluded, 'excluído', 'excluídos'),
  ]
    .filter(Boolean)
    .join(' e ');

/**
 * The predicted order of a project (#55): off by default, remembered per project, ranked again after each decision.
 *
 * @example const order = useScreeningOrder(projectId, decisions); useGuidedScreening(screening, projectId, order.queue);
 */
export function useScreeningOrder(projectId: number, decisions: ScreeningDecision[]) {
  const service = useProjectService();
  const [enabled, setEnabled] = useState(false);
  const [rank, setRank] = useState<ScreeningRank | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);
  const decided = decisions
    .filter((d) => d.stage === 'title')
    .map((d) => `${d.article_id}:${d.label_id}`)
    .join();

  const reRank = useCallback(async () => {
    try {
      setRank(await service.rankScreening(projectId));
      setRankError(null);
    } catch (err) {
      setRankError(describeError(err));
    }
  }, [service, projectId]);

  const vectors = useArticleVectors(projectId, enabled, () => void reRank());

  useEffect(() => {
    let alive = true;
    void service.isScreeningOrderOn(projectId).then((found) => {
      if (alive) setEnabled(found);
    });
    return () => {
      alive = false;
    };
  }, [service, projectId]);

  // `decided`: each decision teaches it something, so the queue is ranked again.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    service
      .rankScreening(projectId)
      .then((found) => {
        if (!alive) return;
        setRank(found);
        setRankError(null);
      })
      .catch((err) => {
        if (alive) setRankError(describeError(err));
      });
    return () => {
      alive = false;
    };
  }, [enabled, decided, service, projectId]);

  const toggle = (next: boolean) => {
    setEnabled(next);
    void service.setScreeningOrderOn(projectId, next);
  };

  return { enabled, toggle, rank, rankError, vectors, queue: enabled && rank?.order.length ? rank.order : null };
}

export type ScreeningOrder = ReturnType<typeof useScreeningOrder>;

const Toggle: React.FC<{ order: ScreeningOrder }> = ({ order }) => (
  <label style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
    <input type="checkbox" checked={order.enabled} onChange={(e) => order.toggle(e.target.checked)} /> Ordenar por
    relevância prevista
  </label>
);

// Only what was observed: an estimate of how many are left looks safe without being, and someone could stop because
// of it, which is the expensive error (author's decision, #55).
const Observed: React.FC<{ decisions: ScreeningDecision[]; labels: ScreeningLabel[] }> = ({ decisions, labels }) => {
  const { relevant, looked } = recentRelevant(decisions, labels, 50);
  return looked === 0 ? null : (
    <span>
      Nos últimos {articles(looked)}, {plural(relevant, 'relevante', 'relevantes')}.
    </span>
  );
};

const GenerateOffer: React.FC<{ order: ScreeningOrder; firstTime: boolean }> = ({ order, firstTime }) => {
  const { plan, generate } = order.vectors;
  if (!plan) return null;
  return (
    <>
      <strong>
        {firstTime
          ? `Gerar os vetores de ${articles(plan.pending)}?`
          : `${articles(plan.pending)} sem vetor no fim da fila.`}
      </strong>
      <span>
        Envia título e resumo para {providerName(plan.provider)}. Com um provedor pago, isso consome tokens. Nenhum
        artigo sai da fila, e o resto é feito neste computador.
      </span>
      {plan.previousModel && (
        <span data-testid="previous-vector-model">
          Prefere não gerar agora? Os vetores atuais vieram de {embeddingModelName(plan.previousModel)}: volte a esse
          modelo em <Link to="/settings">Configurações</Link>.
        </span>
      )}
      <div>
        <button type="button" className="btn-primary" onClick={() => void generate()}>
          {firstTime ? 'Gerar e ordenar' : `Gerar ${plan.pending}`}
        </button>
      </div>
    </>
  );
};

/**
 * The band above the guided screening: what order the queue is in, and why. It only ever changes the order.
 *
 * @example <ScreeningOrderStrip order={order} decisions={decisions} labels={labels} />
 */
export const ScreeningOrderStrip: React.FC<{
  order: ScreeningOrder;
  decisions: ScreeningDecision[];
  labels: ScreeningLabel[];
}> = ({ order, decisions, labels }) => {
  const { enabled, rank, rankError, vectors } = order;
  const failure = vectors.error ?? rankError;
  const { plan, progress } = vectors;
  const firstTime = !!plan && plan.pending === plan.total;
  return (
    <div
      className={failure ? 'review-suggestion review-suggestion--warn' : 'review-suggestion'}
      role="group"
      aria-label="Ordem da triagem"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'space-between' }}>
        <strong>
          {order.queue ? `Ordem prevista, aprendida com ${rank?.learnedFrom} decisões.` : 'Ordem original.'}
        </strong>
        <Toggle order={order} />
      </div>
      {enabled && failure && (
        <span role="alert">
          <strong>Não foi possível ordenar.</strong> {failure} Os artigos sem vetor ficam no fim da fila.
        </span>
      )}
      {enabled && progress && (
        <span role="status">
          Gerando vetores: {progress.done} de {progress.total}…
        </span>
      )}
      {enabled && !progress && plan && plan.pending > 0 && <GenerateOffer order={order} firstTime={firstTime} />}
      {enabled &&
        !progress &&
        !firstTime &&
        rank &&
        !order.queue &&
        (rank.needRelevant > 0 || rank.needExcluded > 0) && (
          <span>Faltam {neededText(rank)} para começar a ordenar. Até lá, vale a ordem original.</span>
        )}
      {order.queue && <Observed decisions={decisions} labels={labels} />}
    </div>
  );
};
