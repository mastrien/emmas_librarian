import React from 'react';
import { Edit2, Trash2, Check, X as XIcon } from 'lucide-react';
import { Project } from '../../../types';
import '../projectPage.css';

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
  handleDeleteProject,
}) => {
  return (
    <div>
      {isEditingName ? (
        <div className="project-name-row project-name-row--editing">
          <input
            className="project-name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button onClick={handleUpdateName} className="btn-primary project-name-confirm">
            <Check size={20} />
          </button>
          <button
            onClick={() => {
              setIsEditingName(false);
              setNewName(project.name);
            }}
            className="btn-secondary project-name-confirm"
          >
            <XIcon size={20} />
          </button>
        </div>
      ) : (
        <div className="project-name-row">
          <h1>{project.name}</h1>
          <button onClick={() => setIsEditingName(true)} className="project-icon-button">
            <Edit2 size={20} />
          </button>
          <button onClick={handleDeleteProject} className="project-icon-button project-icon-button--danger">
            <Trash2 size={20} />
          </button>
        </div>
      )}
      <p className="project-meta">
        Criado em {new Date(project.created_at).toLocaleDateString()} &middot; {articlesCount} artigos no total
      </p>
    </div>
  );
};
