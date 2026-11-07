import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import { MonitorNotices } from './Dashboard/components/MonitorNotices';
import { Project, ScientificVenue, MilestoneStatus } from '../types';
import { MessageSquare, Plus, Download } from 'lucide-react';
import { DashboardCalendar } from '../components/common/DashboardCalendar';
import { DeadlineBanner } from '../components/common/deadlines/DeadlineBanner';
import { VenueFormModal } from '../components/modals/VenueFormModal';

import { DashboardClock } from './Dashboard/components/DashboardClock';
import { DashboardDragDropOverlay } from './Dashboard/components/DashboardDragDropOverlay';
import { DashboardProjectsList } from './Dashboard/components/DashboardProjectsList';
import { DashboardGlobalStats } from './Dashboard/components/DashboardGlobalStats';
import { droppedFilePath } from '../utils/droppedFilePath';
import './Dashboard/dashboard.css';
import { useDialogs } from '../components/common/dialogs/DialogProvider';

// What went wrong, as the import error message always showed it: the error's text, or the value itself.
const errorText = (err: unknown): string => (err instanceof Error && err.message ? err.message : String(err));

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const projectService = useProjectService();
  const { inform } = useDialogs();
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
        const newId = await projectService.importProject(droppedFilePath(file));
        if (newId) {
          window.location.href = `#/projects/${newId}`;
          break;
        }
      } catch (err) {
        await inform({ title: 'Erro ao importar', message: `Erro ao importar ${file.name}: ${errorText(err)}` });
      }
    }
  };

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="dashboard">
      {isDragging && <DashboardDragDropOverlay />}

      {/* Seção da Agenda no Topo */}
      <div className="fade-in dashboard-agenda">
        <div className="dashboard-agenda-top">
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

      <MonitorNotices />

      {/* Cabeçalho dos Projetos */}
      <div className="dashboard-projects-head">
        <div>
          <h1>Seus Projetos</h1>
          <p>Gerencie e acompanhe suas revisões sistemáticas da literatura.</p>
        </div>

        <div className="dashboard-actions">
          <Link to="/ask" className="btn-secondary">
            <MessageSquare size={20} /> Perguntar aos projetos
          </Link>
          <button
            type="button"
            onClick={async () => {
              try {
                const newId = await projectService.importProject();
                if (newId) window.location.href = `#/projects/${newId}`;
              } catch (err) {
                await inform({ title: 'Erro ao importar', message: `Erro ao importar projeto: ${errorText(err)}` });
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
        <div data-testid="dashboard-loading-skeleton" className="fade-in dashboard-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-skeleton-card" />
          ))}
        </div>
      ) : (
        <>
          <DashboardProjectsList projects={projects} />

          <div className="dashboard-terms">
            <Link to="/terms">Ao usar o sistema, você concorda com os Termos de Uso</Link>
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
