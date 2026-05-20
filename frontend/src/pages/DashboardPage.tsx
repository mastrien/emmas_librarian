import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/api';
import { Project } from '../types';
import { Plus, BookOpen, Calendar, ChevronRight } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectService.getProjects();
        setProjects(data);
      } catch (err) {
        console.error('Erro ao buscar projetos', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Projetos</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Gerencie suas pesquisas e bibliotecas de artigos.</p>
        </div>
        <Link to="/new-project" className="btn-primary">
          <Plus size={20} /> Novo Projeto
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div className="fade-in">Carregando projetos...</div>
        </div>
      ) : (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 'auto' }}>
                <Calendar size={14} /> 
                Criado em {new Date(project.created_at).toLocaleDateString()}
              </div>
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
      )}
    </div>
  );
};
