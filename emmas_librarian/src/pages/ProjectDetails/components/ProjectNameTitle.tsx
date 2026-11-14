import React from 'react';
import { Edit2, Trash2, Check, X as XIcon } from 'lucide-react';
import type { Project } from '../../../types';
import type { ProjectActions } from '../hooks/useProjectActions';
import '../projectPage.css';

type RenameProps = Pick<ProjectActions, 'newName' | 'setNewName' | 'saveName' | 'setIsEditingName'> & {
  project: Project;
};

/**
 * The project name as the overview title, or the field that renames it while editing.
 *
 * @example <ProjectNameTitle project={project} actions={actions} />
 */
export const ProjectNameTitle: React.FC<RenameProps & { isEditingName: boolean }> = (props) => {
  if (!props.isEditingName) return <>{props.project.name}</>;
  return (
    <span className="project-name-row project-name-row--editing">
      <input
        className="project-name-input"
        aria-label="Nome do projeto"
        value={props.newName}
        onChange={(e) => props.setNewName(e.target.value)}
        autoFocus
      />
      <button onClick={props.saveName} className="btn-primary project-name-confirm" aria-label="Salvar nome">
        <Check size={20} />
      </button>
      <button
        onClick={() => {
          props.setIsEditingName(false);
          props.setNewName(props.project.name);
        }}
        className="btn-secondary project-name-confirm"
        aria-label="Cancelar"
      >
        <XIcon size={20} />
      </button>
    </span>
  );
};

/**
 * Rename and delete, as quiet icon buttons on the right of the overview header.
 *
 * @example <ProjectNameActions onRename={() => actions.setIsEditingName(true)} onDelete={actions.deleteProject} />
 */
export const ProjectNameActions: React.FC<{ onRename: () => void; onDelete: () => void }> = (props) => (
  <>
    <button
      onClick={props.onRename}
      className="project-icon-button"
      aria-label="Renomear projeto"
      title="Renomear projeto"
    >
      <Edit2 size={18} />
    </button>
    <button
      onClick={props.onDelete}
      className="project-icon-button project-icon-button--danger"
      aria-label="Excluir projeto"
      title="Excluir projeto"
    >
      <Trash2 size={18} />
    </button>
  </>
);
