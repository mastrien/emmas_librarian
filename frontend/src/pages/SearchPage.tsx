import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { QueryBuilder } from '../components/QueryBuilder';
import { projectService } from '../services/api';
import { QueryBlock, Project } from '../types';
import { Search, Loader2, ArrowLeft } from 'lucide-react';

const DATABASES = [
  { id: 'openalex', label: 'OpenAlex' },
  { id: 'crossref', label: 'Crossref' },
  { id: 'scopus', label: 'Scopus (Em breve)', disabled: true },
  { id: 'wos', label: 'Web of Science (Em breve)', disabled: true },
];

export const SearchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [blocks, setBlocks] = useState<QueryBlock[]>([]);
  const [limit, setLimit] = useState(50);
  const [selectedDbs, setSelectedDbs] = useState<string[]>(['openalex', 'crossref']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      projectService.getProject(parseInt(id)).then(setProject).catch(() => navigate('/'));
    }
  }, [id, navigate]);

  const toggleDb = (dbId: string) => {
    setSelectedDbs(prev => 
      prev.includes(dbId) ? prev.filter(db => db !== dbId) : [...prev, dbId]
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || blocks.length === 0 || selectedDbs.length === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      await projectService.searchAndPersist(parseInt(id), blocks, limit);
      navigate(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar busca');
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Link to={`/projects/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        <ArrowLeft size={18} /> Voltar para o Projeto
      </Link>
      
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Fazer Nova Busca</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Projeto: {project.name}</p>
      </div>
      
      <form onSubmit={handleSearch} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text-heading)' }}>Bases de Dados Alvo</label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {DATABASES.map(db => {
              const isSelected = selectedDbs.includes(db.id);
              return (
                <button
                  key={db.id}
                  type="button"
                  onClick={() => !db.disabled && toggleDb(db.id)}
                  disabled={db.disabled}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-xl)',
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    background: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)',
                    fontWeight: 500,
                    cursor: db.disabled ? 'not-allowed' : 'pointer',
                    opacity: db.disabled ? 0.5 : 1,
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {db.label}
                </button>
              );
            })}
          </div>
          {selectedDbs.length === 0 && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>Selecione pelo menos uma base.</p>}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Quantidade Máxima de Artigos a Importar</label>
          <input 
            type="number" 
            value={limit} 
            onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
            min="10"
            max="1000"
            style={{ 
              width: '100%', 
              padding: '0.8rem 1rem', 
              fontSize: '1rem', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          />
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600, color: 'var(--text-heading)' }}>Construtor de Query</label>
          <QueryBuilder blocks={blocks} onChange={setBlocks} />
        </div>

        {error && (
          <div style={{ color: '#ef4444', background: '#fee2e2', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || blocks.length === 0 || selectedDbs.length === 0}
          className="btn-primary"
          style={{ 
            width: '100%',
            padding: '1rem', 
            fontSize: '1.1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
          {loading ? 'Pesquisando e extraindo dados (isso pode levar alguns minutos)...' : 'Fazer Busca'}
        </button>
      </form>
    </div>
  );
};
