import { useEffect, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { Project, ProjectNavCounts } from '../../../types';

export interface ShellProject {
  project?: Project;
  counts?: ProjectNavCounts;
}

/**
 * The project the shell is showing (title bar path and project sidebar): its record and the sidebar counts.
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
    Promise.all([projectService.getProject(projectId), projectService.getProjectNavCounts(projectId)])
      .then(([project, counts]) => current && setLoaded({ id: projectId, project, counts }))
      .catch(() => current && setLoaded({}));
    return () => {
      current = false;
    };
  }, [projectService, projectId, refreshKey]);

  // A stale answer for the previous project never shows under the new one.
  return projectId !== undefined && loaded.id === projectId ? { project: loaded.project, counts: loaded.counts } : {};
}
