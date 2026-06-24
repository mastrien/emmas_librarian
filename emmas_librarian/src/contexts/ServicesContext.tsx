/**
 * ServicesContext — dependency-injection layer for IProjectService.
 *
 * WHY: Lets tests swap the real Electron IPC implementation with a fake,
 * while keeping the default value pointing at the concrete projectService
 * so existing component code needs zero changes.
 *
 * Usage (production — optional, the default already works):
 *   <ServicesProvider apiService={projectService}>
 *     <App />
 *   </ServicesProvider>
 *
 * Usage (tests):
 *   <ServicesProvider apiService={fakeProjectService}>
 *     <ComponentUnderTest />
 *   </ServicesProvider>
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { IProjectService } from '../services/ProjectServiceInterface';
import { projectService } from '../services/api';

/**
 * React context whose value is the active IProjectService implementation.
 * Defaults to the real `projectService` so consumers work even without a
 * wrapping <ServicesProvider>.
 */
const ServicesContext = createContext<IProjectService>(projectService);

/** Props for the ServicesProvider wrapper component. */
interface ServicesProviderProps {
  /** The IProjectService implementation to inject into the tree. */
  apiService: IProjectService;
  children: ReactNode;
}

/**
 * Provides an IProjectService implementation to all descendant components.
 *
 * Usage:
 *   <ServicesProvider apiService={myService}>
 *     <App />
 *   </ServicesProvider>
 */
export function ServicesProvider({
  apiService,
  children,
}: ServicesProviderProps): ReactNode {
  return (
    <ServicesContext.Provider value={apiService}>
      {children}
    </ServicesContext.Provider>
  );
}

/**
 * Hook to read the current IProjectService from context.
 * Throws if called outside a ServicesProvider (should never happen in
 * practice because the context default is the real implementation).
 *
 * Usage:
 *   const api = useProjectService();
 *   const projects = await api.getProjects();
 */
export function useProjectService(): IProjectService {
  const ctx = useContext(ServicesContext);
  if (!ctx) {
    throw new Error(
      'useProjectService must be used within a <ServicesProvider>. ' +
        'Received context value: undefined',
    );
  }
  return ctx;
}

export { ServicesContext };
