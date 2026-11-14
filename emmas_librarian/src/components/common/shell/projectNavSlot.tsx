import React, { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

// A screen can list its own sub-pages under its item of the project sidebar (board 159: the investigations under
// "Investigação com IA"). The sidebar marks the spot; the screen, which already holds that list and keeps it live,
// renders into it through a portal instead of the sidebar fetching it a second time.

interface ProjectNavSlotValue {
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
}

const ProjectNavSlotContext = createContext<ProjectNavSlotValue>({ element: null, setElement: () => undefined });

/**
 * Shares the sidebar's slot between the sidebar and the screen beside it.
 *
 * @example <ProjectNavSlotProvider><ProjectSidebar … /><main>{children}</main></ProjectNavSlotProvider>
 */
export const ProjectNavSlotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ element, setElement }), [element]);
  return <ProjectNavSlotContext.Provider value={value}>{children}</ProjectNavSlotContext.Provider>;
};

/**
 * The spot in the sidebar, under the lit item, where the screen's sub-pages go.
 *
 * @example {isActive && item.slot && <ProjectNavSlotHost />}
 */
export const ProjectNavSlotHost: React.FC = () => {
  const { setElement } = useContext(ProjectNavSlotContext);
  return <div ref={setElement} className="project-nav__slot" />;
};

/**
 * Renders its children in the sidebar's slot; nothing while the sidebar shows none.
 *
 * @example <ProjectNavPortal><InvestigationNavList … /></ProjectNavPortal>
 */
export const ProjectNavPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { element } = useContext(ProjectNavSlotContext);
  return element ? createPortal(children, element) : null;
};
