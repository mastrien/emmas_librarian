import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import { Project, ScientificVenue, MilestoneStatus } from '../types';
import { Plus, BookOpen, Calendar, ChevronRight, PieChart as PieChartIcon, Download } from 'lucide-react';
import { DashboardCalendar } from '../components/common/DashboardCalendar';
import { DeadlineBanner } from '../components/common/DeadlineBanner';
import { VenueFormModal } from '../components/modals/VenueFormModal';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const projectService = useProjectService();
  const [projects, setProjects] = useState<Project[]>([]);
  const [venues, setVenues] = useState<ScientificVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Modal State
  const [isAddVenueModalOpen, setIsAddVenueModalOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Real-time Clock State
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTimeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const currentDateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const loadData = async () => {
    try {
      const data = await projectService.getProjects();

      const projectsWithStats = await Promise.all(
        data.map(async (project) => {
          const articles = await projectService.getArticles(project.id);
          const diaryEntries = await projectService.getDiaryEntries(project.id);
          return {
            ...project,
            stats: {
              total: articles.length,
              read: articles.filter((a) => a.status === 'read').length,
              active: articles.filter((a) => a.status === 'new').length,
              archived: articles.filter((a) => a.status === 'archived').length,
              withPdf: articles.filter((a) => !!a.local_file_path).length,
              diaryDates: (diaryEntries as any[]).map((d: any) => d.entry_date),
            },
          };
        }),
      );

      setProjects(projectsWithStats as any);

      // Load Agenda Venues
      const venuesData = await projectService.getScientificVenues();
      setVenues(venuesData || []);
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddVenueModal = (dateStr?: string) => {
    setSelectedCalendarDate(dateStr || null);
    setIsAddVenueModalOpen(true);
  };

  const handleSaveVenue = async (venueData: Omit<ScientificVenue, 'id' | 'created_at'>) => {
    try {
      await projectService.createScientificVenue(venueData);
      setIsAddVenueModalOpen(false);
      const updated = await projectService.getScientificVenues();
      setVenues(updated || []);
    } catch (err) {
      console.error('Erro ao criar evento:', err);
    }
  };

  const handleToggleMilestoneStatus = async (milestoneId: number, status: MilestoneStatus) => {
    try {
      await projectService.toggleMilestoneStatus(milestoneId, status);
      const updated = await projectService.getScientificVenues();
      setVenues(updated || []);
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    }
  };

  const globalStats = projects.reduce(
    (acc, p: any) => {
      if (p.stats) {
        acc.total += p.stats.total;
        acc.read += p.stats.read;
        acc.active += p.stats.active;
        acc.archived += p.stats.archived;
        acc.withPdf += p.stats.withPdf;
        if (p.stats.diaryDates) {
          p.stats.diaryDates.forEach((d: string) => acc.diarySet.add(d));
        }
      }
      return acc;
    },
    { total: 0, read: 0, active: 0, archived: 0, withPdf: 0, diarySet: new Set<string>() },
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.emmapcarc'));
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const pathToImport = (file as any).path || file.name;
        const newId = await projectService.importProject(pathToImport);
        if (newId) {
          window.location.href = `#/projects/${newId}`;
          break;
        }
      } catch (err: any) {
        alert(`Erro ao importar ${file.name}: ` + (err.message || err));
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ minHeight: '80vh', position: 'relative' }}
    >
      {/* Overlay do Drag and Drop */}
      {isDragging &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              border: '3px dashed var(--color-primary)',
              pointerEvents: 'none',
            }}
          >
            <Download size={64} color="var(--color-primary)" className="bounce-subtle" />
            <h2 style={{ marginTop: '1.5rem', fontSize: '1.8rem', fontWeight: 700 }}>
              Solte o arquivo do projeto (.emmapcarc) aqui
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>
              O projeto será importado automaticamente para a sua biblioteca.
            </p>
          </div>,
          document.body,
        )}

      {/* Seção da Agenda no Topo (Minimalista & Coluna Esquerda Maior com Cores Neutras) */}
      <div
        className="fade-in"
        style={{
          marginBottom: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Grid: Esquerda Maior (1.4fr 320px) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 320px', gap: '1.5rem', alignItems: 'center' }}>
          {/* Esquerda: Relógio e Data Centralizados com Cores Neutras (Sem var(--color-primary)) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '3.75rem',
                fontWeight: 800,
                color: 'var(--text-heading)',
                fontFamily: 'monospace',
                letterSpacing: '-1px',
                lineHeight: 1,
              }}
            >
              {currentTimeStr}
            </div>
            <div
              style={{
                fontSize: '0.95rem',
                color: 'var(--text-muted)',
                fontWeight: 500,
                textTransform: 'capitalize',
                marginTop: '0.6rem',
              }}
            >
              {currentDateStr}
            </div>
          </div>

          {/* Direita: Calendário Mensal */}
          <div>
            <DashboardCalendar
              diarySet={globalStats.diarySet}
              venues={venues}
              onAddVenue={handleOpenAddVenueModal}
              onOpenAgenda={() => navigate('/agenda')}
              onSelectDate={(dStr) => handleOpenAddVenueModal(dStr)}
            />
          </div>
        </div>

        {/* Linha Inferior: Banner de Prazos Próximos */}
        <div>
          <DeadlineBanner
            venues={venues}
            onToggleMilestoneStatus={handleToggleMilestoneStatus}
            onOpenAgenda={() => navigate('/agenda')}
          />
        </div>
      </div>

      {/* Cabeçalho dos Projetos */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
            Seus Projetos
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Gerencie e acompanhe suas revisões sistemáticas da literatura.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {projects.map((project) => (
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
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.8rem',
                      background: 'var(--bg-main)',
                      color: 'var(--color-primary)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <BookOpen size={24} />
                  </div>
                  <ChevronRight size={20} color="var(--border-color)" style={{ marginTop: '0.5rem' }} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--text-heading)' }}>
                  {project.name}
                </h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  <Calendar size={14} />
                  Criado em {new Date(project.created_at).toLocaleDateString()}
                </div>

                {/* @ts-ignore */}
                {project.stats && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                    }}
                  >
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
              <div
                className="glass-panel"
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '4rem 2rem',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <BookOpen size={48} color="var(--color-primary)" style={{ opacity: 0.8, marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', margin: '0 0 0.5rem 0' }}>
                  Nenhum projeto encontrado
                </h3>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem 0' }}>
                  Crie seu primeiro projeto para começar a importar e analisar artigos científicos.
                </p>
                <Link to="/new-project" className="btn-primary">
                  <Plus size={20} /> Criar Primeiro Projeto
                </Link>
              </div>
            )}
          </div>

          {/* Seção dos Gráficos Globais (Metade da Largura Cada Um) */}
          {projects.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
                marginTop: '3rem',
              }}
            >
              {/* Gráfico 1: Status dos Artigos */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PieChartIcon size={20} color="var(--color-primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                    Distribuição dos Artigos (Global)
                  </h3>
                </div>

                {globalStats.total === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Nenhum artigo importado ainda.
                  </div>
                ) : (
                  <div style={{ height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Pie
                      data={{
                        labels: ['Novos / Ativos', 'Lidos', 'Arquivados'],
                        datasets: [
                          {
                            data: [globalStats.active, globalStats.read, globalStats.archived],
                            backgroundColor: ['#3b82f6', '#10b981', '#6b7280'],
                            borderWidth: 1,
                            borderColor: 'var(--bg-surface)',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: 'var(--text-main)',
                              font: { family: 'sans-serif', size: 12 },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Gráfico 2: Disponibilidade de PDFs */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PieChartIcon size={20} color="var(--color-primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                    Disponibilidade de Texto Completo (PDF)
                  </h3>
                </div>

                {globalStats.total === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Nenhum artigo importado ainda.
                  </div>
                ) : (
                  <div style={{ height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Pie
                      data={{
                        labels: ['Com PDF Anexado', 'Apenas Metadados'],
                        datasets: [
                          {
                            data: [globalStats.withPdf, Math.max(0, globalStats.total - globalStats.withPdf)],
                            backgroundColor: ['#8b5cf6', '#f59e0b'],
                            borderWidth: 1,
                            borderColor: 'var(--bg-surface)',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: 'var(--text-main)',
                              font: { family: 'sans-serif', size: 12 },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Form */}
      <VenueFormModal
        isOpen={isAddVenueModalOpen}
        onClose={() => setIsAddVenueModalOpen(false)}
        onSave={handleSaveVenue}
        initialDate={selectedCalendarDate}
      />
    </div>
  );
};
