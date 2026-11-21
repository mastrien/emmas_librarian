import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LocalWorkspace, WorkspaceStatus } from '../local/LocalWorkspace';
import type { ProjectReader } from '../reader/ProjectReader';

export interface Session {
  /** The library on screen, or null on the start screen. */
  reader: ProjectReader | null;
  /** Leaves the library: forgets the open file, or this device's token. */
  leave: () => void;
  /** The phone's own library and its sync, when the app runs on it; null for a file or the live desktop. */
  workspace?: LocalWorkspace | null;
}

export const SessionContext = createContext<Session>({ reader: null, leave: () => undefined });

/**
 * The library the screens read. Screens under a library route always have one.
 *
 * @example const reader = useReader(); const projects = await reader.listProjects();
 */
export function useReader(): ProjectReader {
  const { reader } = useContext(SessionContext);
  if (!reader)
    throw new Error('useReader was called on a screen with no library open; expected a route under RequireLibrary');
  return reader;
}

export const useSession = (): Session => useContext(SessionContext);

/**
 * Puts a session where the app would, for tests and for the app itself.
 *
 * @example <SessionProvider reader={reader} leave={leave}><ProjectsScreen /></SessionProvider>
 */
export const SessionProvider: React.FC<Session & { children: React.ReactNode }> = ({
  reader,
  leave,
  workspace = null,
  children,
}) => <SessionContext.Provider value={{ reader, leave, workspace }}>{children}</SessionContext.Provider>;

/**
 * The phone's workspace and its status, redrawn when a sync starts, ends or a pairing is made.
 *
 * @example const { workspace, status } = useWorkspace(); status?.pendingChanges
 */
export function useWorkspace(): { workspace: LocalWorkspace | null; status: WorkspaceStatus | null } {
  const { workspace } = useContext(SessionContext);
  const [status, setStatus] = useState<WorkspaceStatus | null>(workspace?.status() ?? null);
  useEffect(() => {
    if (!workspace) return setStatus(null);
    setStatus(workspace.status());
    return workspace.subscribe(() => setStatus(workspace.status()));
  }, [workspace]);
  return { workspace: workspace ?? null, status };
}
