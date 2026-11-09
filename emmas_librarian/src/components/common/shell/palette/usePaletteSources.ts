import { useEffect, useState } from 'react';
import { useProjectService } from '../../../../contexts/ServicesContext';
import type { PaletteSources } from './paletteCommands';

/**
 * What the palette searches, loaded when it opens: every project and, inside a project, its articles.
 * A failed load leaves that part empty; the places and actions still work.
 *
 * @example const sources = usePaletteSources(projectIdOf(pathname));
 */
export function usePaletteSources(currentProjectId: number | undefined): PaletteSources {
  const projectService = useProjectService();
  const [loaded, setLoaded] = useState<Omit<PaletteSources, 'currentProjectId'>>({ projects: [], articles: [] });

  useEffect(() => {
    let current = true;
    const articles =
      currentProjectId === undefined ? Promise.resolve([]) : projectService.getArticles(currentProjectId);
    Promise.all([projectService.getProjects().catch(() => []), articles.catch(() => [])]).then(
      ([projects, projectArticles]) => current && setLoaded({ projects, articles: projectArticles }),
    );
    return () => {
      current = false;
    };
  }, [projectService, currentProjectId]);

  return { ...loaded, currentProjectId };
}
