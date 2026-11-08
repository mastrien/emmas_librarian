import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, ChevronRight, Plus } from 'lucide-react';
import { Project } from '../../../types';
import '../dashboard.css';

interface DashboardProjectsListProps {
  projects: Project[];
}

const ProjectStats: React.FC<{ stats: NonNullable<Project['stats']> }> = ({ stats }) => (
  <div className="project-card-stats">
    <div className="project-card-stat project-card-stat--active">
      <span>Ativos</span>
      <strong>{stats.active}</strong>
    </div>
    <div className="project-card-stat project-card-stat--read">
      <span>Lidos</span>
      <strong>{stats.read}</strong>
    </div>
    <div className="project-card-stat project-card-stat--archived">
      <span>Arquivados</span>
      <strong>{stats.archived}</strong>
    </div>
  </div>
);

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
  <Link to={`/projects/${project.id}`} className="card hover-lift fade-in project-card">
    <div className="project-card-top">
      <div className="project-card-icon">
        <BookOpen size={24} />
      </div>
      <ChevronRight size={20} className="project-card-chevron" />
    </div>
    <h3>{project.name}</h3>
    <div className="project-card-date">
      <Calendar size={14} />
      Criado em {new Date(project.created_at).toLocaleDateString()}
    </div>
    {project.stats && <ProjectStats stats={project.stats} />}
  </Link>
);

const NoProjects: React.FC = () => (
  <div className="glass-panel projects-empty">
    <BookOpen size={48} className="projects-empty-icon" />
    <h3>Nenhum projeto encontrado</h3>
    <p>Crie seu primeiro projeto para começar a importar e analisar artigos científicos.</p>
    <Link to="/new-project" className="btn-primary">
      <Plus size={20} /> Criar Primeiro Projeto
    </Link>
  </div>
);

/**
 * The dashboard's project cards, with each project's article counts, or the invitation to create the first one.
 *
 * @example <DashboardProjectsList projects={projects} />
 */
export const DashboardProjectsList: React.FC<DashboardProjectsListProps> = ({ projects }) => (
  <div className="project-cards">
    {projects.map((project) => (
      <ProjectCard key={project.id} project={project} />
    ))}
    {projects.length === 0 && <NoProjects />}
  </div>
);
