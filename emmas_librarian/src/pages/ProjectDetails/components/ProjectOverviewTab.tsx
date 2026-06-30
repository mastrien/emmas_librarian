import React from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Article } from '../../../types';

interface ProjectOverviewTabProps {
  activeArticles: Article[];
  readArticles: Article[];
  archivedArticles: Article[];
  filteredArticles: Article[];
}

export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({
  activeArticles,
  readArticles,
  archivedArticles,
  filteredArticles,
}) => {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div
          className="card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>Status dos Artigos</h3>
          <div style={{ width: '100%', height: '300px', position: 'relative' }}>
            <Pie
              data={{
                labels: ['Ativos', 'Lidos', 'Arquivados'],
                datasets: [
                  {
                    data: [activeArticles.length, readArticles.length, archivedArticles.length],
                    backgroundColor: ['#3b82f6', '#10b981', '#6b7280'],
                    borderWidth: 0,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    cornerRadius: 8,
                  },
                },
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Ativos (
              {activeArticles.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} /> Lidos (
              {readArticles.length})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#6b7280' }} /> Arquivados (
              {archivedArticles.length})
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>Artigos por Ano</h3>
          <div style={{ width: '100%', height: '300px', position: 'relative' }}>
            <Bar
              data={{
                labels: Object.entries(
                  filteredArticles.reduce((acc: Record<string, number>, art) => {
                    const year = art.year ? art.year.toString() : 'N/A';
                    acc[year] = (acc[year] || 0) + 1;
                    return acc;
                  }, {}),
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([year]) => year),
                datasets: [
                  {
                    label: 'Quantidade',
                    data: Object.entries(
                      filteredArticles.reduce((acc: Record<string, number>, art) => {
                        const year = art.year ? art.year.toString() : 'N/A';
                        acc[year] = (acc[year] || 0) + 1;
                        return acc;
                      }, {}),
                    )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([, count]) => count),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>Acesso Aberto (Open Access)</h3>
          <div style={{ width: '100%', height: '300px', position: 'relative' }}>
            <Pie
              data={(() => {
                const oa = filteredArticles.filter((a) => a.is_oa === 1).length;
                const nonOa = filteredArticles.length - oa;
                return {
                  labels: ['Open Access', 'Closed / Não especificado'],
                  datasets: [
                    {
                      data: [oa, nonOa],
                      backgroundColor: ['#10b981', '#ef4444'],
                      borderWidth: 0,
                    },
                  ],
                };
              })()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'bottom' },
                },
              }}
            />
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>Artigos por Base de Dados</h3>
          <div style={{ width: '100%', height: '300px', position: 'relative' }}>
            <Pie
              data={(() => {
                const counts = filteredArticles.reduce((acc: Record<string, number>, art) => {
                  let db = art.source_databases || 'Desconhecido';
                  try {
                    const parsed = JSON.parse(db);
                    if (Array.isArray(parsed) && parsed.length > 0) db = parsed[0];
                  } catch (e) {
                    /* ignore */
                  }
                  acc[db] = (acc[db] || 0) + 1;
                  return acc;
                }, {});
                return {
                  labels: Object.keys(counts),
                  datasets: [
                    {
                      data: Object.values(counts),
                      backgroundColor: [
                        '#10b981',
                        '#3b82f6',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6',
                        '#6366f1',
                        '#14b8a6',
                        '#f43f5e',
                        '#a855f7',
                      ],
                      borderWidth: 0,
                    },
                  ],
                };
              })()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'bottom' },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div
          className="card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>Top 10 Editoras / Publishers</h3>
          <div style={{ width: '100%', height: '300px', position: 'relative' }}>
            <Bar
              data={(() => {
                const counts = filteredArticles.reduce((acc: Record<string, number>, art) => {
                  const pub = art.publisher || 'Desconhecido';
                  acc[pub] = (acc[pub] || 0) + 1;
                  return acc;
                }, {});
                const sorted = Object.entries(counts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10);
                return {
                  labels: sorted.map((i) => (i[0].length > 15 ? i[0].substring(0, 15) + '...' : i[0])),
                  datasets: [
                    {
                      label: 'Quantidade',
                      data: sorted.map((i) => i[1]),
                      backgroundColor: '#8b5cf6',
                      borderRadius: 4,
                    },
                  ],
                };
              })()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h3 style={{ margin: '0 0 1rem 0' }}>Completude de DOI</h3>
          <div style={{ width: '100%', height: '300px', position: 'relative' }}>
            <Pie
              data={(() => {
                const comDoi = filteredArticles.filter((a) => a.doi && a.doi.trim().length > 0).length;
                const semDoi = filteredArticles.length - comDoi;
                return {
                  labels: ['Com DOI', 'Sem DOI'],
                  datasets: [
                    {
                      data: [comDoi, semDoi],
                      backgroundColor: ['#10b981', '#ef4444'],
                      borderWidth: 0,
                    },
                  ],
                };
              })()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'bottom' },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
