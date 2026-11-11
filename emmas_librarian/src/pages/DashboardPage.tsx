import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import { MonitorNotices } from './Dashboard/components/MonitorNotices';
import { Project, ScientificVenue, MilestoneStatus, type Article, type DiaryEntry } from '../types';
import { MessageSquare, Plus, Download } from 'lucide-react';
import { DashboardCalendar } from '../components/common/DashboardCalendar';
import { DeadlineBanner } from '../components/common/deadlines/DeadlineBanner';
import { VenueFormModal } from '../components/modals/VenueFormModal';

import { PageHeader } from '../components/common/PageHeader';
import { DashboardClock } from './Dashboard/components/DashboardClock';
import { homeTotals } from './Dashboard/homeNumbers';
import { DashboardDragDropOverlay } from './Dashboard/components/DashboardDragDropOverlay';
import { DashboardProjectsList } from './Dashboard/components/DashboardProjectsList';
import { DashboardGlobalStats } from './Dashboard/components/DashboardGlobalStats';
import { droppedFilePath } from '../utils/droppedFilePath';
import { importProjectWithFeedback } from '../utils/importProjectWithFeedback';
import './Dashboard/dashboard.css';
import { useDialogs } from '../components/common/dialogs/DialogProvider';

/**
 * One project's article counts for its card, and the days of its diary.
 *
 * @example projectStats(articles, diaryEntries).read // 7
 */
export function projectStats(
  articles: Article[],
  diary: Pick<DiaryEntry, 'entry_date'>[],
): NonNullable<Project['stats']> {
  const count = (status: Article['status']) => articles.filter((a) => a.status === status).length;
  return {
    total: articles.length,
    read: count('read'),
    active: count('new'),
    archived: count('archived'),
    withPdf: articles.filter((a) => !!a.local_file_path).length,
    diaryDates: diary.map((d) => d.entry_date),
  };
}

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
      const [data, screenings] = await Promise.all([
        projectService.getProjects(),
        projectService.getScreeningSummaries(),
      ]);

      const projectsWithStats = await Promise.all(
        data.map(async (project) => ({
          ...project,
          screening: screenings[project.id],
          stats: projectStats(
            await projectService.getArticles(project.id),
            (await projectService.getDiaryEntries(project.id)) as DiaryEntry[],
          ),
        })),
      );

      setProjects(projectsWithStats);

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

  const totals = homeTotals(projects);

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
      const newId = await importProjectWithFeedback(projectService, inform, {
        path: droppedFilePath(file),
        what: file.name,
      });
      if (newId) {
        window.location.href = `#/projects/${newId}`;
        break;
      }
    }
  };

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="dashboard">
      {isDragging && <DashboardDragDropOverlay />}

      <PageHeader
        eyebrow={<DashboardClock />}
        title="Início"
        actions={
          <>
            <Link to="/ask" className="btn-secondary">
              <MessageSquare size={18} aria-hidden="true" /> Perguntar aos projetos
            </Link>
            <button
              type="button"
              onClick={async () => {
                const newId = await importProjectWithFeedback(projectService, inform);
                if (newId) window.location.href = `#/projects/${newId}`;
              }}
              className="btn-secondary"
              title="Importar projeto (.emmapcarc)"
            >
              <Download size={18} aria-hidden="true" /> Importar
            </button>
            <Link to="/new-project" className="btn-primary">
              <Plus size={18} aria-hidden="true" /> Novo projeto
            </Link>
          </>
        }
      />

      <div className="home-columns">
        <div className="home-main">
          <MonitorNotices />
          {loading ? (
            <div data-testid="dashboard-loading-skeleton" className="fade-in dashboard-skeleton">
              {[1, 2, 3].map((i) => (
                <div key={i} className="dashboard-skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              <DashboardProjectsList projects={projects} />
              {projects.length > 0 && totals.total > 0 && <DashboardGlobalStats totals={totals} />}
            </>
          )}
        </div>

        <aside className="home-side" aria-label="Agenda">
          <section className="card home-side__card" aria-label="Próximos prazos">
            <DeadlineBanner
              venues={venues}
              onToggleMilestoneStatus={handleToggleMilestoneStatus}
              onOpenAgenda={() => navigate('/agenda')}
            />
          </section>
          <section className="card home-side__card" aria-label="Calendário">
            <DashboardCalendar
              diarySet={totals.diaryDays}
              venues={venues}
              onAddVenue={handleOpenAddVenueModal}
              onOpenAgenda={() => navigate('/agenda')}
              onSelectDate={(dStr) => handleOpenAddVenueModal(dStr)}
            />
          </section>
          <p className="home-terms">
            <Link to="/terms">Ao usar o sistema, você concorda com os Termos de Uso</Link>
          </p>
        </aside>
      </div>

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
