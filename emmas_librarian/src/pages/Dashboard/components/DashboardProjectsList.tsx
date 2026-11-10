import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Project } from '../../../types';
import { SegmentedControl, type SegmentedOption } from '../../../components/common/SegmentedControl';
import { readPercent, sortProjects, type ProjectOrder } from '../homeNumbers';
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

/** The reading progress and the four counts of a card (board 151). */
const ProjectStats: React.FC<{ stats: NonNullable<Project['stats']> }> = ({ stats }) => (
  <>
    <div className="project-card-progress">
      <div className="project-card-progress__line">
        <span>Leitura</span>
        <strong>
          {stats.read} de {stats.active + stats.read} lidos
        </strong>
      </div>
      <progress
        max={100}
        value={readPercent(stats)}
        aria-label={`${readPercent(stats)}% lidos`}
        className="home-progress home-progress--ok"
      />
    </div>
    <div className="project-card-stats">
      <Tile label="Ativos" value={stats.active} />
      <Tile label="Lidos" value={stats.read} />
      <Tile label="Com PDF" value={stats.withPdf} />
      <Tile label="Arquivados" value={stats.archived} />
    </div>
  </>
);

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
  <Link to={`/projects/${project.id}`} className="card hover-lift fade-in project-card">
    <div className="project-card-title">
      <h3>{project.name}</h3>
      <span className="project-card-date">Criado em {new Date(project.created_at).toLocaleDateString('pt-BR')}</span>
    </div>
    {project.stats && <ProjectStats stats={project.stats} />}
  </Link>
);

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
 * The project cards of the home screen (board 151): "Projetos" with their count and the order (Recentes or A–Z),
 * each card with its reading progress and counts, and a card that starts a new project.
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
