import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ScreeningSimulation } from '../../types';
import { describeError } from '../../utils/describeError';
import { embeddingModelName } from '../../utils/pdfCount';
import { providerName } from '../../utils/screeningCriteria';
import { useArticleVectors } from './useArticleVectors';
import { ExperimentalTag } from '../../components/common/ExperimentalTag';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const cssColor = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim();

const line = (label: string, data: number[], color: string) => ({
  label,
  data,
  borderColor: color,
  backgroundColor: color,
  borderWidth: 2,
  pointRadius: 0,
  tension: 0,
});

const FoundChart: React.FC<{ simulation: ScreeningSimulation }> = ({ simulation }) => {
  const muted = cssColor('--text-muted');
  const axis = (text: string) => ({
    title: { display: true, text, color: muted },
    ticks: { color: muted, maxTicksLimit: 8 },
    grid: { color: cssColor('--border-color') },
  });
  return (
    <div style={{ position: 'relative', height: '320px' }}>
      <Line
        aria-label="Relevantes encontrados por artigos triados, na ordem prevista e na original"
        role="img"
        data={{
          labels: simulation.predicted.map((_, i) => i + 1),
          datasets: [
            line('Ordem prevista', simulation.predicted, cssColor('--color-primary')),
            line('Ordem original', simulation.original, cssColor('--color-warning')),
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          scales: { x: axis('Artigos triados'), y: { ...axis('Relevantes encontrados'), beginAtZero: true } },
          plugins: { legend: { labels: { color: muted } } },
        }}
      />
    </div>
  );
};

// About a third of the way in: where a person could stop early, which is what the order is for.
const checkpoint = ({ articles }: ScreeningSimulation) => Math.max(1, Math.round(articles * 0.3));

const FoundTable: React.FC<{ simulation: ScreeningSimulation }> = ({ simulation }) => {
  const steps = [0.15, 0.3, 0.5, 0.75, 1].map((share) => Math.max(1, Math.round(simulation.articles * share)));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="review-table">
        <caption className="review-muted" style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>
          Relevantes encontrados, dos {simulation.relevant} do projeto
        </caption>
        <thead>
          <tr>
            <th scope="col">Artigos triados</th>
            <th scope="col">Ordem prevista</th>
            <th scope="col">Ordem original</th>
          </tr>
        </thead>
        <tbody>
          {[...new Set(steps)].map((step) => (
            <tr key={step}>
              <td>{step}</td>
              <td>{simulation.predicted[step - 1]}</td>
              <td>{simulation.original[step - 1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Result: React.FC<{ simulation: ScreeningSimulation }> = ({ simulation }) => {
  const at = checkpoint(simulation);
  return (
    <>
      <p style={{ margin: 0, maxWidth: '68ch' }}>
        <strong>
          Com a ordem prevista, {simulation.predicted[at - 1]} dos {simulation.relevant} relevantes apareceriam nos
          primeiros {at} artigos. Na ordem original, {simulation.original[at - 1]}.
        </strong>
      </p>
      {simulation.withoutVector > 0 && (
        <p className="review-muted" style={{ margin: 0 }}>
          {simulation.withoutVector} artigos decididos ficaram de fora por não terem vetor.
        </p>
      )}
      <FoundChart simulation={simulation} />
      <FoundTable simulation={simulation} />
      <p className="review-muted" style={{ margin: 0, maxWidth: '72ch' }}>
        A simulação usa decisões que você já tomou, então mostra como a ordenação teria funcionado neste projeto. Não
        garante o mesmo resultado em outro.
      </p>
    </>
  );
};

/**
 * Screens a finished project again on this computer, with the person's decisions as the answers, to show how much the
 * predicted order would have helped before anyone trusts it (#55).
 *
 * @example <SimulationSection projectId={3} />
 */
export const SimulationSection: React.FC<{ projectId: number }> = ({ projectId }) => {
  const service = useProjectService();
  const vectors = useArticleVectors(projectId, true);
  const [simulation, setSimulation] = useState<ScreeningSimulation | null>(null);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { plan, progress } = vectors;

  const simulate = async () => {
    setRunning(true);
    setProblem(null);
    try {
      setSimulation(await service.simulateScreening(projectId));
    } catch (err) {
      setProblem(describeError(err));
    } finally {
      setRunning(false);
    }
  };

  const failure = problem ?? vectors.error;
  return (
    <section className="review-section review-evaluation" aria-label="Simular a ordenação">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Simular a ordenação</h2>
        <ExperimentalTag reason="A simulação ainda não foi comparada com uma triagem real feita com a ordem prevista." />
      </div>
      <p style={{ margin: 0, maxWidth: '72ch' }}>
        Refaz a triagem no computador, usando as suas decisões como resposta, para mostrar quanto a ordem prevista teria
        ajudado. Não muda nenhuma decisão, e o resultado se repete.
      </p>
      {plan && plan.pending > 0 && !progress && (
        <div className="review-suggestion review-suggestion--warn">
          <span>
            {plan.pending} artigos ainda não têm vetor. Gerar envia título e resumo para {providerName(plan.provider)},
            e com um provedor pago isso consome tokens.
          </span>
          {plan.previousModel && (
            <span>
              Prefere não gerar agora? Os vetores atuais vieram de {embeddingModelName(plan.previousModel)}: volte a
              esse modelo em Configurações.
            </span>
          )}
          <button type="button" className="review-small" onClick={() => void vectors.generate()}>
            Gerar {plan.pending} vetores
          </button>
        </div>
      )}
      {progress && (
        <p role="status" style={{ margin: 0 }}>
          Gerando vetores: {progress.done} de {progress.total}…
        </p>
      )}
      {failure && (
        <p role="alert" style={{ margin: 0 }}>
          {failure}
        </p>
      )}
      <div>
        <button
          type="button"
          className="btn-primary"
          disabled={running || !!progress || !plan || plan.total === plan.pending}
          onClick={() => void simulate()}
        >
          {running ? 'Simulando…' : 'Simular'}
        </button>
      </div>
      {simulation &&
        (simulation.articles === 0 ? (
          <p className="review-muted" style={{ margin: 0 }}>
            Decida alguns artigos na triagem para poder simular.
          </p>
        ) : (
          <Result simulation={simulation} />
        ))}
    </section>
  );
};
