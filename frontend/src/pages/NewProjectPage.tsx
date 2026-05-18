import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QueryBuilder } from '../components/QueryBuilder';
import { projectService } from '../services/api';
import { QueryBlock } from '../types';
import { Search, Loader2 } from 'lucide-react';

export const NewProjectPage: React.FC = () => {
  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<QueryBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreateAndSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      // 1. Create project
      const project = await projectService.createProject(name);
      
      // 2. Run search if there are blocks
      if (blocks.length > 0) {
        await projectService.searchAndPersist(project.id, blocks);
      }
      
      // 3. Redirect to project page
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao criar projeto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Novo Projeto de Pesquisa</h1>
      
      <form onSubmit={handleCreateAndSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nome do Projeto</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Sistemas de Recomendação na Educação"
            style={{ width: '100%', padding: '0.6rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            required
          />
        </div>

        <QueryBuilder blocks={blocks} onChange={setBlocks} />

        {error && <div style={{ color: '#ef4444', background: '#fee2e2', padding: '0.8rem', borderRadius: '4px' }}>{error}</div>}

        <button 
          type="submit" 
          disabled={loading || !name.trim()}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '0.6rem', 
            padding: '0.8rem', 
            background: '#0ea5e9', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '1.1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
          Criar e Buscar Artigos
        </button>
      </form>
    </div>
  );
};
