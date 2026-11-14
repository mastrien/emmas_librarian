import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Await, Empty, ScreenHeader } from '../components';
import { useReader, useSession } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

/**
 * The projects of the library on screen, and the way out of it.
 *
 * @example <Route path="/projects" element={<ProjectsScreen />} />
 */
export const ProjectsScreen: React.FC = () => {
  const reader = useReader();
  const { leave } = useSession();
  const projects = useLoaded(useCallback(() => reader.listProjects(), [reader]));
  const leaveLabel = reader.source === 'desktop' ? 'Desconectar' : 'Fechar arquivo';
  return (
    <main className="m-screen">
      <ScreenHeader
        title="Projetos"
        action={
          <button className="m-link" onClick={leave}>
            {leaveLabel}
          </button>
        }
      />
      <p className="m-source">
        {reader.source === 'desktop'
          ? 'Biblioteca do computador, ao vivo.'
          : 'Arquivo aberto neste aparelho, somente leitura.'}
      </p>
      <Await loaded={projects}>
        {(list) =>
          list.length === 0 ? (
            <Empty>Nenhum projeto nesta biblioteca.</Empty>
          ) : (
            <ul className="m-list">
              {list.map((project) => (
                <li key={project.id}>
                  <Link to={`/projects/${project.id}`} className="m-row">
                    <span className="m-row__title">{project.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Await>
    </main>
  );
};
