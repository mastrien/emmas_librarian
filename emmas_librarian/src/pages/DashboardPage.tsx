import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import { Project, ScientificVenue, MilestoneStatus } from '../types';
import { Plus, Download } from 'lucide-react';
import { DashboardCalendar } from '../components/common/DashboardCalendar';
import { DeadlineBanner } from '../components/common/DeadlineBanner';
import { VenueFormModal } from '../components/modals/VenueFormModal';

import { DashboardClock } from './Dashboard/components/DashboardClock';
import { DashboardDragDropOverlay } from './Dashboard/components/DashboardDragDropOverlay';
import { DashboardProjectsList } from './Dashboard/components/DashboardProjectsList';
import { DashboardGlobalStats } from './Dashboard/components/DashboardGlobalStats';

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
        acc.active += p.stats.active;
        acc.read += p.stats.read;
        acc.archived += p.stats.archived;
        acc.total += p.stats.total;
        acc.withPdf += p.stats.withPdf;
        if (p.stats.diaryDates) {
          p.stats.diaryDates.forEach((d: string) => acc.diarySet.add(d));
        }
      }
      return acc;
    },
    { active: 0, read: 0, archived: 0, total: 0, withPdf: 0, diarySet: new Set<string>() },
  );

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
      style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', minHeight: '100vh' }}
    >
      {isDragging && <DashboardDragDropOverlay />}

      {/* Seção da Agenda no Topo */}
      <div
        className="fade-in"
        style={{
          marginBottom: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 320px', gap: '1.5rem', alignItems: 'center' }}>
          <DashboardClock />
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
          <DashboardProjectsList projects={projects} />

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link
              to="/terms"
              style={{
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Ao usar o sistema, você concorda com os Termos de Uso
            </Link>
          </div>

          {!loading && projects.length > 0 && hasData && (
            <DashboardGlobalStats statusChartData={statusChartData} chartData={chartData} />
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
