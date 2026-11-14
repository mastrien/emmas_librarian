import React, { createContext, useContext } from 'react';
import type { ProjectReader } from '../reader/ProjectReader';

export interface Session {
  /** The library on screen, or null on the start screen. */
  reader: ProjectReader | null;
  /** Leaves the library: forgets the open file, or this device's token. */
  leave: () => void;
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
export const SessionProvider: React.FC<Session & { children: React.ReactNode }> = ({ reader, leave, children }) => (
  <SessionContext.Provider value={{ reader, leave }}>{children}</SessionContext.Provider>
);
