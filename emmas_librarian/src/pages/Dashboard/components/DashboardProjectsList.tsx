import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, ChevronRight, Plus } from 'lucide-react';
import { Project } from '../../../types';

interface DashboardProjectsListProps {
  projects: Project[];
}

export const DashboardProjectsList: React.FC<DashboardProjectsListProps> = ({ projects }) => {
  return (
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
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--text-heading)' }}>{project.name}</h3>
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
  );
};
