import { createContext, useContext } from 'react';

// A project screen that changes what the sidebar counts (imports, a new category, a search) asks the shell to
// count again; otherwise the counts only refresh on the next navigation. Outside the shell it does nothing.
const ProjectNavRefreshContext = createContext<() => void>(() => undefined);

export const ProjectNavRefreshProvider = ProjectNavRefreshContext.Provider;

/**
 * The function that makes the project sidebar reload its name and counts.
 *
 * @example const refreshProjectNav = useRefreshProjectNav(); await save(); refreshProjectNav();
 */
export function useRefreshProjectNav(): () => void {
  return useContext(ProjectNavRefreshContext);
}
