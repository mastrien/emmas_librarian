import React from 'react';
import { Edit2, Trash2, Check, X as XIcon } from 'lucide-react';
import { Project } from '../../../types';

interface ProjectHeaderProps {
  project: Project;
  articlesCount: number;
  isEditingName: boolean;
  setIsEditingName: (val: boolean) => void;
  newName: string;
  setNewName: (val: string) => void;
  handleUpdateName: () => void;
  handleDeleteProject: () => void;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  articlesCount,
  isEditingName,
  setIsEditingName,
  newName,
  setNewName,
  handleUpdateName,
  handleDeleteProject
}) => {
  return (
    <div>
      {isEditingName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              background: 'var(--bg-main)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-heading)',
              padding: '0.2rem 0.5rem',
              width: '100%',
              maxWidth: '600px',
            }}
            autoFocus
          />
          <button onClick={handleUpdateName} className="btn-primary" style={{ padding: '0.5rem' }}>
            <Check size={20} />
          </button>
          <button
            onClick={() => {
              setIsEditingName(false);
              setNewName(project.name);
            }}
            className="btn-secondary"
            style={{ padding: '0.5rem' }}
          >
            <XIcon size={20} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{project.name}</h1>
          <button
            onClick={() => setIsEditingName(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
            }}
          >
            <Edit2 size={20} />
          </button>
          <button
            onClick={handleDeleteProject}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-danger)',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
            }}
          >
            <Trash2 size={20} />
          </button>
        </div>
      )}
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>
        Criado em {new Date(project.created_at).toLocaleDateString()} &middot; {articlesCount} artigos no total
      </p>
    </div>
  );
};
