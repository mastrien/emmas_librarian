import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/api';
import { Project } from '../types';
import { Plus, Book, Calendar, ChevronRight } from 'lucide-react';

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
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Meus Projetos</h1>
        <Link 
          to="/new-project" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            padding: '0.6rem 1.2rem', 
            background: '#0ea5e9', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '6px',
            fontWeight: '600'
          }}
        >
          <Plus size={20} /> Novo Projeto
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Carregando projetos...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {projects.map(project => (
            <Link 
              key={project.id} 
              to={`/projects/${project.id}`}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '1.5rem', 
                background: 'white', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.1s, border-color 0.1s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0ea5e9')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.8rem', background: '#f0f9ff', color: '#0ea5e9', borderRadius: '8px' }}>
                  <Book size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{project.name}</h3>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', color: '#64748b', fontSize: '0.9rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={14} /> {new Date(project.data_criacao).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight size={20} color="#94a3b8" />
            </Link>
          ))}

          {projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Você ainda não criou nenhum projeto.</p>
              <Link to="/new-project" style={{ color: '#0ea5e9', fontWeight: 'bold' }}>Começar agora</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
