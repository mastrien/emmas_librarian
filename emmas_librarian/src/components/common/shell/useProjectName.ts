import { useEffect, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';

/**
 * The name of a project for the title bar path, reloaded when the id or the route changes (a rename on the
 * project page shows up on the next navigation). Undefined while loading, outside a project or on error.
 *
 * @example const name = useProjectName(projectIdOf(pathname), pathname);
 */
export function useProjectName(projectId: number | undefined, pathname: string): string | undefined {
  const projectService = useProjectService();
  const [name, setName] = useState<string | undefined>();

  useEffect(() => {
    if (projectId === undefined) return;
    let current = true;
    projectService
      .getProject(projectId)
      .then((project) => current && setName(project.name))
      .catch(() => current && setName(undefined));
    return () => {
      current = false;
    };
  }, [projectService, projectId, pathname]);

  return projectId === undefined ? undefined : name;
}
