import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../../types';

// Closes on a click anywhere else, as a dropdown does.
function useClickOutside(onOutside: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onOutside]);
  return box;
}

const ProjectMenu: React.FC<{
  projects: Project[];
  scope: number[];
  onToggle: (id: number, chosen: boolean) => void;
}> = ({ projects, scope, onToggle }) => (
  <div className="ask-menu custom-controls" role="group" aria-label="Projetos que respondem">
    {projects.map((project) => (
      <label key={project.id}>
        <input
          type="checkbox"
          checked={scope.includes(project.id)}
          onChange={(e) => onToggle(project.id, e.target.checked)}
        />
        <span>{project.name}</span>
      </label>
    ))}
    {projects.length === 0 && <span className="ask-muted">Nenhum projeto criado ainda.</span>}
  </div>
);

/**
 * Which projects answer. They can change during a conversation: each answer keeps what it read.
 *
 * @example <AskScopeBar projects={projects} scope={[1]} onChange={setScope} />
 */
export const AskScopeBar: React.FC<{
  projects: Project[];
  scope: number[];
  onChange: (scope: number[]) => void;
}> = ({ projects, scope, onChange }) => {
  const [open, setOpen] = useState(false);
  const box = useClickOutside(() => setOpen(false));
  const toggle = (id: number, chosen: boolean) =>
    onChange(chosen ? [...scope, id] : scope.filter((project) => project !== id));
  const chosen = projects.filter((project) => scope.includes(project.id));
  return (
    <div className="ask-scope" ref={box}>
      <span className="ask-muted">Respondendo com:</span>
      {chosen.map((project) => (
        <span key={project.id} className="ask-chip">
          <span className="ask-chip-name">{project.name}</span>
          <button type="button" aria-label={`Tirar ${project.name}`} onClick={() => toggle(project.id, false)}>
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" className="ask-add" aria-expanded={open} onClick={() => setOpen(!open)}>
        + projeto
      </button>
      {open && <ProjectMenu projects={projects} scope={scope} onToggle={toggle} />}
    </div>
  );
};
