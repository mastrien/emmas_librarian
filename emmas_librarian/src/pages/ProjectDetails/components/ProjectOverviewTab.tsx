import React from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Article } from '../../../types';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  articlesByDatabase,
  articlesByYear,
  doiCompleteness,
  openAccessSplit,
  topPublishers,
  type ChartSeries,
} from './overview/projectStats';
import './overview/overview.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface ProjectOverviewTabProps {
  activeArticles: Article[];
  readArticles: Article[];
  archivedArticles: Article[];
  filteredArticles: Article[];
}

const BAR_COLOR = '#8b5cf6';
const SPLIT_COLORS = ['#10b981', '#ef4444'];
const DATABASE_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#6366f1',
  '#14b8a6',
  '#f43f5e',
  '#a855f7',
];
const STATUS_COLORS = ['#3b82f6', '#10b981', '#6b7280'];

const PIE_WITH_LEGEND = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'bottom' as const } },
};
const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } },
};

const pieData = (series: ChartSeries, colors: string[]) => ({
  labels: series.labels,
  datasets: [{ data: series.data, backgroundColor: colors, borderWidth: 0 }],
});

const barData = (series: ChartSeries) => ({
  labels: series.labels,
  datasets: [{ label: 'Quantidade', data: series.data, backgroundColor: BAR_COLOR, borderRadius: 4 }],
});

const ChartCard: React.FC<{ title: string; children: React.ReactNode; footer?: React.ReactNode }> = (props) => (
  <div className="card overview-card">
    <h3>{props.title}</h3>
    <div className="overview-chart">{props.children}</div>
    {props.footer}
  </div>
);

const StatusChart: React.FC<{ counts: [number, number, number] }> = ({ counts }) => {
  const labels = ['Ativos', 'Lidos', 'Arquivados'];
  const legend = (
    <div className="overview-legend">
      {labels.map((label, i) => (
        <div key={label} className="overview-legend-item">
          <div className={`overview-legend-dot overview-legend-dot--${i}`} /> {label} ({counts[i]})
        </div>
      ))}
    </div>
  );
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 },
    },
  };
  return (
    <ChartCard title="Status dos Artigos" footer={legend}>
      <Pie data={pieData({ labels, data: counts }, STATUS_COLORS)} options={options} />
    </ChartCard>
  );
};

/**
 * The project's statistics tab: status, years, open access, databases, publishers and DOI completeness.
 *
 * @example <ProjectOverviewTab activeArticles={a} readArticles={r} archivedArticles={x} filteredArticles={f} />
 */
export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = (props) => {
  const articles = props.filteredArticles;
  return (
    <div className="fade-in overview">
      <div className="overview-grid">
        <StatusChart counts={[props.activeArticles.length, props.readArticles.length, props.archivedArticles.length]} />
        <ChartCard title="Artigos por Ano">
          <Bar data={barData(articlesByYear(articles))} options={BAR_OPTIONS} />
        </ChartCard>
        <ChartCard title="Acesso Aberto (Open Access)">
          <Pie data={pieData(openAccessSplit(articles), SPLIT_COLORS)} options={PIE_WITH_LEGEND} />
        </ChartCard>
        <ChartCard title="Artigos por Base de Dados">
          <Pie data={pieData(articlesByDatabase(articles), DATABASE_COLORS)} options={PIE_WITH_LEGEND} />
        </ChartCard>
      </div>
      <div className="overview-grid">
        <ChartCard title="Top 10 Editoras / Publishers">
          <Bar data={barData(topPublishers(articles))} options={BAR_OPTIONS} />
        </ChartCard>
        <ChartCard title="Completude de DOI">
          <Pie data={pieData(doiCompleteness(articles), SPLIT_COLORS)} options={PIE_WITH_LEGEND} />
        </ChartCard>
      </div>
    </div>
  );
};
