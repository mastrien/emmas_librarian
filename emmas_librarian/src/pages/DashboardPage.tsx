import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/api';
import { Project } from '../types';
import { Plus, BookOpen, Calendar, ChevronRight, PieChart as PieChartIcon, Download } from 'lucide-react';
import { DashboardCalendar } from '../components/DashboardCalendar';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectService.getProjects();
        
        const projectsWithStats = await Promise.all(data.map(async (project) => {
          const articles = await projectService.getArticles(project.id);
          const diaryEntries = await projectService.getDiaryEntries(project.id);
          return {
            ...project,
            stats: {
              total: articles.length,
              read: articles.filter(a => a.status === 'read').length,
              active: articles.filter(a => a.status === 'new').length,
              archived: articles.filter(a => a.status === 'archived').length,
              withPdf: articles.filter(a => !!a.local_file_path).length,
              diaryDates: diaryEntries.map(d => d.entry_date),
            }
          };
        }));
        
        setProjects(projectsWithStats as any);
      } catch (err) {
        console.error('Erro ao buscar projetos', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const globalStats = projects.reduce((acc, p: any) => {
    if (p.stats) {
      acc.active += p.stats.active;
      acc.read += p.stats.read;
      acc.archived += p.stats.archived;
      acc.total += p.stats.total;
      acc.withPdf += p.stats.withPdf;
      if (p.stats.diaryDates) {
        p.stats.diaryDates.forEach((date: string) => {
          acc.diarySet.add(date);
        });
      }
    }
    return acc;
  }, { active: 0, read: 0, archived: 0, total: 0, withPdf: 0, diarySet: new Set<string>() });

  // Generate heatmap data for last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: dateStr,
      active: globalStats.diarySet.has(dateStr)
    };
  });

  const chartData = {
    labels: ['Com PDF Vinculado', 'Sem PDF'],
    datasets: [
      {
        data: [globalStats.withPdf, globalStats.total - globalStats.withPdf],
        backgroundColor: ['#10b981', '#6b7280'],
        borderWidth: 0,
      },
    ],
  };

  const statusChartData = {
    labels: ['Ativos', 'Lidos', 'Arquivados'],
    datasets: [
      {
        data: [globalStats.active, globalStats.read, globalStats.archived],
        backgroundColor: ['#3b82f6', '#10b981', '#6b7280'],
        borderWidth: 0,
      },
    ],
  };

  const hasData = globalStats.total > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const emmapcarcFiles = files.filter(f => f.name.endsWith('.emmapcarc'));
    
    if (emmapcarcFiles.length > 0) {
      try {
        // @ts-ignore
        const filePath = window.electronAPI && window.electronAPI.getPathForFile ? window.electronAPI.getPathForFile(emmapcarcFiles[0]) : (emmapcarcFiles[0].path || emmapcarcFiles[0].name);
        const newId = await projectService.importProject(filePath);
        if (newId) window.location.href = `#/projects/${newId}`;
      } catch (err: any) {
        alert('Erro ao importar projeto: ' + (err.message || err));
      }
    }
  };

  return (
    <div 
      style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', minHeight: '100vh' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '8px dashed var(--color-primary)'
        }}>
          <h2 style={{ color: 'white', fontSize: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Download size={60} /> Solte o arquivo .emmapcarc em qualquer lugar para importar
          </h2>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Projetos</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Gerencie suas pesquisas e bibliotecas de artigos.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={async () => {
              try {
                const newId = await projectService.importProject();
                if (newId) window.location.href = `#/projects/${newId}`;
              } catch (err: any) {
                alert('Erro ao importar projeto: ' + (err.message || err));
              }
            }} 
            className="btn-secondary"
            title="Importar projeto (.emmapcarc)"
          >
            <Download size={20} /> Importar
          </button>
          <Link to="/new-project" className="btn-primary">
            <Plus size={20} /> Novo Projeto
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div className="fade-in">Carregando projetos...</div>
        </div>
      ) : (
        <>
          {projects.length > 0 && hasData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              
              <div className="fade-in card" style={{
                display: 'flex',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                padding: '1.5rem',
                alignItems: 'center',
                gap: '1.5rem',
                flexDirection: 'row'
              }}>
                <div style={{ width: '120px', height: '120px', position: 'relative', flexShrink: 0 }}>
                  <Pie 
                    data={statusChartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 }
                      }
                    }} 
                  />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    <PieChartIcon size={18} /> Progresso Geral
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {statusChartData.datasets[0].data.map((val, index) => {
                      if (val === 0) return null;
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: statusChartData.datasets[0].backgroundColor[index] }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{statusChartData.labels[index]}</span>
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {val}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="fade-in card" style={{
                display: 'flex',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                padding: '1.5rem',
                alignItems: 'center',
                gap: '1.5rem',
                flexDirection: 'row'
              }}>
                <div style={{ width: '120px', height: '120px', position: 'relative', flexShrink: 0 }}>
                  <Pie 
                    data={chartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8 }
                      }
                    }} 
                  />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    <PieChartIcon size={18} /> Arquivos Físicos
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {chartData.datasets[0].data.map((val, index) => {
                      if (val === 0) return null;
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: chartData.datasets[0].backgroundColor[index] as string }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{chartData.labels[index]}</span>
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {val}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DashboardCalendar diarySet={globalStats.diarySet} />
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {projects.map(project => (
            <Link 
              key={project.id} 
              to={`/projects/${project.id}`}
              className="card hover-lift fade-in"
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                padding: '1.5rem', 
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ 
                  padding: '0.8rem', 
                  background: 'var(--bg-main)', 
                  color: 'var(--color-primary)', 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <BookOpen size={24} />
                </div>
                <ChevronRight size={20} color="var(--border-color)" style={{ marginTop: '0.5rem' }} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--text-heading)' }}>
                {project.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Calendar size={14} /> 
                Criado em {new Date(project.created_at).toLocaleDateString()}
              </div>
              
              {/* @ts-ignore */}
              {project.stats && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ativos</span>
                    {/* @ts-ignore */}
                    <strong style={{ color: 'var(--color-primary)' }}>{project.stats.active}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Lidos</span>
                    {/* @ts-ignore */}
                    <strong style={{ color: 'var(--color-success, #10b981)' }}>{project.stats.read}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Arquivados</span>
                    {/* @ts-ignore */}
                    <strong style={{ color: 'var(--text-muted)' }}>{project.stats.archived}</strong>
                  </div>
                </div>
              )}
            </Link>
          ))}

          {projects.length === 0 && (
            <div className="fade-in" style={{ 
              gridColumn: '1 / -1',
              textAlign: 'center', 
              padding: '5rem 2rem', 
              background: 'var(--bg-surface)', 
              borderRadius: 'var(--radius-xl)', 
              border: '2px dashed var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '50%', color: 'var(--text-muted)' }}>
                <BookOpen size={48} />
              </div>
              <h2 style={{ margin: 0, color: 'var(--text-heading)' }}>Nenhum projeto encontrado</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '400px' }}>
                Comece sua pesquisa criando um novo projeto. Você poderá buscar artigos do OpenAlex e Crossref diretamente nele.
              </p>
              <Link to="/new-project" className="btn-primary" style={{ marginTop: '1rem' }}>
                Criar meu primeiro projeto
              </Link>
            </div>
          )}
        </div>
        </>
      )}
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', transition: 'background-color var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          Ao usar o sistema, você concorda com os Termos de Uso
        </Link>
      </div>
    </div>
  );
};
