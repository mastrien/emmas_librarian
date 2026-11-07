import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import '../dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

/** One pie's numbers, labels and colours, as DashboardPage builds them for Chart.js. */
export interface PieSummary {
  labels: string[];
  datasets: { data: number[]; backgroundColor: string[]; borderWidth?: number }[];
}

interface DashboardGlobalStatsProps {
  statusChartData: PieSummary;
  chartData: PieSummary;
}

const PIE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 },
  },
};

// The legend beside the pie: each non-zero slice with its colour (a CSS variable: it comes from the data) and count.
const PieLegend: React.FC<{ summary: PieSummary }> = ({ summary }) => {
  const [dataset] = summary.datasets;
  return (
    <div className="stats-legend">
      {dataset.data.map((value, index) =>
        value === 0 ? null : (
          <div key={index}>
            <div className="stats-legend-label">
              <div
                className="stats-legend-dot"
                style={{ '--dot-color': dataset.backgroundColor[index] } as React.CSSProperties}
              />
              <span>{summary.labels[index]}</span>
            </div>
            <div className="stats-legend-value">{value}</div>
          </div>
        ),
      )}
    </div>
  );
};

const StatsPie: React.FC<{ title: string; summary: PieSummary }> = ({ title, summary }) => (
  <div className="fade-in stats-block">
    <div className="stats-pie">
      <Pie data={summary} options={PIE_OPTIONS} />
    </div>
    <div>
      <h3 className="stats-title">
        <PieChartIcon size={16} /> {title}
      </h3>
      <PieLegend summary={summary} />
    </div>
  </div>
);

/**
 * The two pies under the project cards: articles by status, and articles with or without a PDF.
 *
 * @example <DashboardGlobalStats statusChartData={byStatus} chartData={byPdf} />
 */
export const DashboardGlobalStats: React.FC<DashboardGlobalStatsProps> = ({ statusChartData, chartData }) => (
  <div className="stats-grid">
    <StatsPie title="Progresso Geral" summary={statusChartData} />
    <StatsPie title="Arquivos Físicos" summary={chartData} />
  </div>
);
