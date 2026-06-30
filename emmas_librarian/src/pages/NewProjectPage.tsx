import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import { Plus, Loader2 } from 'lucide-react';

export const NewProjectPage: React.FC = () => {
  const projectService = useProjectService();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const project = await projectService.createProject(name);
      navigate(`/projects/${project.id}`);
    } catch (err: unknown) {
      let errorMsg = 'Erro ao criar projeto';
      if (err) {
        if ((err as Error).message) {
          errorMsg = (err as Error).message;
          errorMsg = errorMsg.replace(/^Error:\s*Error\s*invoking\s*remote\s*method\s*'.*?':\s*/i, '');
        } else if (typeof err === 'string') {
          errorMsg = err;
        } else if (typeof err === 'object') {
          try {
            errorMsg = (err as { error?: string }).error || JSON.stringify(err);
          } catch {
            errorMsg = String(err);
          }
        } else {
          errorMsg = String(err);
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '4rem auto' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Novo Projeto</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Dê um nome para sua nova biblioteca de artigos.</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="card"
        style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}
      >
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Nome do Projeto
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Sistemas de Recomendação na Educação"
            style={{
              width: '100%',
              padding: '0.8rem 1rem',
              fontSize: '1rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            required
            autoFocus
          />
        </div>

        {error && (
          <div
            style={{
              color: '#ef4444',
              background: '#fee2e2',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fca5a5',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
          Criar Projeto
        </button>
      </form>
    </div>
  );
};
