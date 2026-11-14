import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteCommand, PaletteGroup } from './paletteCommands';

/** A command a screen offers: it lands in "Nesta tela" unless it says another group. */
export type ScreenCommand = Omit<PaletteCommand, 'group'> & { group?: PaletteGroup };

interface PageCommandsApi {
  /** Registers the commands of one screen under its own key, replacing what that key had; returns the way out. */
  register: (owner: string, commands: PaletteCommand[]) => () => void;
  commands: PaletteCommand[];
}

const PageCommandsContext = createContext<PageCommandsApi | null>(null);

/**
 * Holds what the open screens offered the Ctrl+K palette ("Nova entrada", "Ordenar por ano", …), so the palette can
 * list them first without knowing any screen.
 *
 * @example <PageCommandsProvider><Layout>…</Layout></PageCommandsProvider>
 */
export const PageCommandsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [byOwner, setByOwner] = useState<Record<string, PaletteCommand[]>>({});
  const register = useCallback((owner: string, commands: PaletteCommand[]) => {
    setByOwner((current) => ({ ...current, [owner]: commands }));
    return () =>
      setByOwner((current) => {
        const { [owner]: _gone, ...rest } = current;
        return rest;
      });
  }, []);
  const api = useMemo(() => ({ register, commands: Object.values(byOwner).flat() }), [register, byOwner]);
  return <PageCommandsContext.Provider value={api}>{children}</PageCommandsContext.Provider>;
};

/** The commands the open screens registered, in the order they were registered. */
export function useRegisteredCommands(): PaletteCommand[] {
  return useContext(PageCommandsContext)?.commands ?? [];
}

/**
 * Offers the palette some commands while this screen is mounted. The callbacks may change on every render: the
 * palette always runs the latest ones.
 *
 * @example usePageCommands('agenda', [{ id: 'agenda:today', label: 'Ir para hoje', run: goToday }]);
 */
export function usePageCommands(owner: string, commands: ScreenCommand[]): void {
  const api = useContext(PageCommandsContext);
  const latest = useRef(commands);
  useEffect(() => {
    latest.current = commands;
  });
  // The palette sees stable wrappers, so a screen re-rendering with new callbacks does not re-register.
  const labels = commands.map((c) => `${c.id}\u0000${c.label}\u0000${c.hint ?? ''}`).join('\u0001');
  useEffect(() => {
    if (!api) return;
    const wrapped: PaletteCommand[] = latest.current.map((c, index) => ({
      ...c,
      group: c.group ?? 'Nesta tela',
      run: () => latest.current[index]?.run?.(),
    }));
    return api.register(owner, wrapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api?.register, owner, labels]);
}
