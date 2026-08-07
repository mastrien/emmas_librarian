import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DashboardGlobalStatsProps {
  statusChartData: any;
  chartData: any;
}

export const DashboardGlobalStats: React.FC<DashboardGlobalStatsProps> = ({ statusChartData, chartData }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', marginTop: '3rem' }}>
      <div
        className="fade-in"
        style={{
          gridColumn: 'span 6',
          display: 'flex',
          background: 'transparent',
          alignItems: 'center',
          gap: '1rem',
          flexDirection: 'row',
        }}
      >
        <div style={{ width: '100px', height: '100px', position: 'relative', flexShrink: 0 }}>
          <Pie
            data={statusChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 },
              },
            }}
          />
        </div>
        <div>
          <h3
            style={{
              margin: '0 0 1rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem',
            }}
          >
            <PieChartIcon size={16} /> Progresso Geral
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {statusChartData.datasets[0].data.map((val: number, index: number) => {
              if (val === 0) return null;
              return (
                <div key={index}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: statusChartData.datasets[0].backgroundColor[index],
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {statusChartData.labels[index]}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-heading)' }}>{val}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="fade-in"
        style={{
          gridColumn: 'span 6',
          display: 'flex',
          background: 'transparent',
          alignItems: 'center',
          gap: '1rem',
          flexDirection: 'row',
        }}
      >
        <div style={{ width: '100px', height: '100px', position: 'relative', flexShrink: 0 }}>
          <Pie
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 },
              },
            }}
          />
        </div>
        <div>
          <h3
            style={{
              margin: '0 0 1rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem',
            }}
          >
            <PieChartIcon size={16} /> Arquivos Físicos
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {chartData.datasets[0].data.map((val: number, index: number) => {
              if (val === 0) return null;
              return (
                <div key={index}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: chartData.datasets[0].backgroundColor[index] as string,
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {chartData.labels[index]}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-heading)' }}>{val}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
