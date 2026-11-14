import { useEffect, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { Project, ProjectDocument, ProjectNavCounts } from '../../../types';

export interface ShellProject {
  project?: Project;
  counts?: ProjectNavCounts;
  documents?: ProjectDocument[];
}

/**
 * The project the shell is showing (title bar path and project sidebar): its record, the sidebar counts and its
 * quick access links.
 * Reloaded when the id, the route or `refreshKey` changes; empty outside a project, while loading or on error.
 *
 * @example const { project, counts } = useShellProject(projectIdOf(pathname), `${pathname}:${navVersion}`);
 */
export function useShellProject(projectId: number | undefined, refreshKey: string): ShellProject {
  const projectService = useProjectService();
  const [loaded, setLoaded] = useState<ShellProject & { id?: number }>({});

  useEffect(() => {
    if (projectId === undefined) return;
    let current = true;
    Promise.all([
      projectService.getProject(projectId),
      projectService.getProjectNavCounts(projectId),
      projectService.getProjectDocuments(projectId),
    ])
      .then(([project, counts, documents]) => current && setLoaded({ id: projectId, project, counts, documents }))
      .catch(() => current && setLoaded({}));
    return () => {
      current = false;
    };
  }, [projectService, projectId, refreshKey]);

  // A stale answer for the previous project never shows under the new one.
  if (projectId === undefined || loaded.id !== projectId) return {};
  return { project: loaded.project, counts: loaded.counts, documents: loaded.documents };
}
