import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../../src/types';
import { Await, Empty, ScreenHeader } from '../components';
import type { ProjectStanding } from '../reader/ProjectReader';
import { useReader, useSession, useWorkspace } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';
import { BottomNav } from './BottomNav';

type ProjectRow = Project & Partial<ProjectStanding>;

const ProjectChips: React.FC<{ project: ProjectRow }> = ({ project }) => (
  <span className="m-row__detail">
    {project.origin === 'own' && <span className="m-chip">Só no celular</span>}
    {project.origin === 'synced' && <span className="m-chip m-chip--synced">Sincronizado</span>}
    {!!project.pendingChanges && (
      <span className="m-chip m-chip--waiting"> {project.pendingChanges} aguardando o computador</span>
    )}
  </span>
);

const NewProject: React.FC<{ onCreate: (name: string) => Promise<unknown> }> = ({ onCreate }) => {
  const [name, setName] = useState('');
  const create = () => onCreate(name.trim()).then(() => setName(''));
  return (
    <section className="m-card">
      <h2>Novo projeto só no celular</h2>
      <input
        className="m-input"
        aria-label="Nome do projeto"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button className="m-button" disabled={name.trim() === ''} onClick={() => void create()}>
        Criar projeto
      </button>
    </section>
  );
};

const ProjectList: React.FC<{ projects: ProjectRow[] }> = ({ projects }) =>
  projects.length === 0 ? (
    <Empty>Nenhum projeto nesta biblioteca.</Empty>
  ) : (
    <ul className="m-list">
      {projects.map((project) => (
        <li key={project.id}>
          <Link to={`/projects/${project.id}`} className="m-row">
            <span className="m-row__title">{project.name}</span>
            <ProjectChips project={project} />
          </Link>
        </li>
      ))}
    </ul>
  );

const SourceNote: React.FC = () => {
  const reader = useReader();
  const { status } = useWorkspace();
  if (reader.source === 'desktop') return <p className="m-source">Biblioteca do computador, ao vivo.</p>;
  if (reader.source === 'file') return <p className="m-source">Arquivo aberto neste aparelho, somente leitura.</p>;
  if (!status?.pairedTo)
    return <p className="m-source">Biblioteca deste celular. Pareie com o computador em Ajustes para sincronizar.</p>;
  return <p className="m-source">Pareado com {status.pairedTo}.</p>;
};

/**
 * The projects of the library on screen, and the way out of it.
 *
 * @example <Route path="/projects" element={<ProjectsScreen />} />
 */
export const ProjectsScreen: React.FC = () => {
  const reader = useReader();
  const { leave } = useSession();
  const local = reader.source === 'local';
  const projects = useLoaded(useCallback(() => reader.listProjects(), [reader]));
  const leaveLabel = reader.source === 'desktop' ? 'Desconectar' : 'Fechar arquivo';
  const reload = projects.state === 'ready' ? projects.reload : () => undefined;
  return (
    <main className={`m-screen${local ? ' m-screen--nav' : ''}`}>
      <ScreenHeader
        title="Projetos"
        action={
          local ? undefined : (
            <button className="m-link" onClick={leave}>
              {leaveLabel}
            </button>
          )
        }
      />
      <SourceNote />
      <Await loaded={projects}>{(list: ProjectRow[]) => <ProjectList projects={list} />}</Await>
      {reader.writer?.createProject && (
        <NewProject onCreate={(name) => reader.writer!.createProject!(name).then(reload)} />
      )}
      {local && <BottomNav />}
    </main>
  );
};
