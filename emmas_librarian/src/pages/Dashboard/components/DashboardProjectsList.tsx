import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Project } from '../../../types';
import { SegmentedControl, type SegmentedOption } from '../../../components/common/SegmentedControl';
import { openedAgo, readPercent, sharePercent, sortProjects, type ProjectOrder } from '../homeNumbers';
import '../dashboard.css';

interface DashboardProjectsListProps {
  projects: Project[];
}

const ORDERS: SegmentedOption<ProjectOrder>[] = [
  { value: 'recent', label: 'Recentes' },
  { value: 'az', label: 'A–Z' },
];

const Tile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="project-card-stat">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

interface ProgressLineProps {
  label: string;
  summary: string;
  percent: number;
  tone: 'ok' | 'accent';
}

const ProgressLine: React.FC<ProgressLineProps> = ({ label, summary, percent, tone }) => (
  <div className="project-card-progress">
    <div className="project-card-progress__line">
      <span>{label}</span>
      <strong>{summary}</strong>
    </div>
    <progress
      max={100}
      value={percent}
      aria-label={`${label}: ${percent}%`}
      className={`home-progress home-progress--${tone}`}
    />
  </div>
);

/**
 * The progress of a card (board 151): a project that had interaction with the systematic review shows how far the
 * screening by title and abstract went; any other shows how much of it was read.
 */
const CardProgress: React.FC<{ project: Project }> = ({ project }) => {
  const stats = project.stats!;
  if (project.screening) {
    const total = stats.total;
    return (
      <ProgressLine
        label="Triagem por título e resumo"
        summary={`${project.screening.decided} de ${total}`}
        percent={sharePercent(project.screening.decided, total)}
        tone="accent"
      />
    );
  }
  return (
    <ProgressLine
      label="Leitura"
      summary={`${stats.read} de ${stats.active + stats.read} lidos`}
      percent={readPercent(stats)}
      tone="ok"
    />
  );
};

/** The four counts of a card. */
const ProjectStats: React.FC<{ stats: NonNullable<Project['stats']> }> = ({ stats }) => (
  <div className="project-card-stats">
    <Tile label="Ativos" value={stats.active} />
    <Tile label="Lidos" value={stats.read} />
    <Tile label="Com PDF" value={stats.withPdf} />
    <Tile label="Arquivados" value={stats.archived} />
  </div>
);

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
  const opened = openedAgo(project.last_opened_at, new Date());
  return (
    <Link to={`/projects/${project.id}`} className="card hover-lift fade-in project-card">
      <div className="project-card-head">
        {project.screening && <span className="project-card-badge">Revisão sistemática</span>}
        {opened && <span className="project-card-opened">{opened}</span>}
      </div>
      <div className="project-card-title">
        <h3>{project.name}</h3>
        <span className="project-card-date">Criado em {new Date(project.created_at).toLocaleDateString('pt-BR')}</span>
      </div>
      {project.stats && <CardProgress project={project} />}
      {project.stats && <ProjectStats stats={project.stats} />}
    </Link>
  );
};

const NewProjectCard: React.FC = () => (
  <Link to="/new-project" className="project-card project-card--new">
    <span className="project-card-new__halo" aria-hidden="true">
      <Plus size={20} />
    </span>
    <strong>Novo projeto</strong>
    <span>Ou arraste um arquivo .emmapcarc para importar.</span>
  </Link>
);

const NoProjects: React.FC = () => (
  <div className="glass-panel projects-empty">
    <h3>Nenhum projeto encontrado</h3>
    <p>Crie seu primeiro projeto para começar a importar e analisar artigos científicos.</p>
  </div>
);

/**
 * The project cards of the home screen (board 151): "Projetos" with their count and the order (Recentes, by last
 * opened, or A–Z), each card with its progress (screening or reading), when it was opened and its counts, and a card that starts a new project.
 *
 * @example <DashboardProjectsList projects={projects} />
 */
export const DashboardProjectsList: React.FC<DashboardProjectsListProps> = ({ projects }) => {
  const [order, setOrder] = useState<ProjectOrder>('recent');
  return (
    <section aria-label="Projetos" className="home-projects">
      <div className="home-section-head">
        <h2>Projetos</h2>
        <span className="home-section-head__count">{projects.length}</span>
        <span className="home-section-head__end">
          <SegmentedControl label="Ordem dos projetos" value={order} options={ORDERS} onChange={setOrder} />
        </span>
      </div>
      {projects.length === 0 && <NoProjects />}
      <div className="project-cards">
        {sortProjects(projects, order).map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <NewProjectCard />
      </div>
    </section>
  );
};
