import React, { useCallback } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';
import { ArticlesTab } from './ArticlesTab';
import { DiaryTab } from './DiaryTab';
import { LinksTab } from './LinksTab';

const TABS = [
  { id: 'articles', label: 'Artigos' },
  { id: 'diary', label: 'Diário' },
  { id: 'links', label: 'Acesso rápido' },
] as const;

type TabId = (typeof TABS)[number]['id'];
const tabOf = (segment: string | undefined): TabId => TABS.find((tab) => tab.id === segment)?.id ?? 'articles';

/**
 * One project: its articles, its diary and its quick access links, each in a tab of the address.
 *
 * @example <Route path="/projects/:projectId/:tab?" element={<ProjectScreen />} />
 */
export const ProjectScreen: React.FC = () => {
  const params = useParams();
  const projectId = Number(params.projectId);
  const tab = tabOf(params.tab);
  const reader = useReader();
  const projects = useLoaded(useCallback(() => reader.listProjects(), [reader]));
  const name =
    projects.state === 'ready' ? projects.value.find((project) => project.id === projectId)?.name : undefined;
  return (
    <main className="m-screen">
      <ScreenHeader title={name ?? 'Projeto'} back="/projects" />
      <nav className="m-tabs" aria-label="Partes do projeto">
        {TABS.map(({ id, label }) => (
          <NavLink
            key={id}
            to={`/projects/${projectId}/${id}`}
            className={`m-tab${id === tab ? ' is-active' : ''}`}
            aria-current={id === tab ? 'page' : undefined}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {tab === 'articles' && <ArticlesTab projectId={projectId} />}
      {tab === 'diary' && <DiaryTab projectId={projectId} />}
      {tab === 'links' && <LinksTab projectId={projectId} />}
    </main>
  );
};
