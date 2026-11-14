import React, { useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import { ChangelogModal } from '../modals/ChangelogModal';
import { UpdateNotificationBanner } from './UpdateNotificationBanner';
import { useProjectService } from '../../contexts/ServicesContext';
import { AppTitleBar } from './shell/AppTitleBar';
import { ModuleRail } from './shell/ModuleRail';
import { ProjectSidebar } from './shell/ProjectSidebar';
import { breadcrumbTrail, projectIdOf } from './shell/breadcrumbs';
import { isFocusRoute, projectSegmentOf } from './shell/projectNav';
import { ProjectNavRefreshProvider } from './shell/projectNavRefresh';
import { ProjectNavSlotProvider } from './shell/projectNavSlot';
import { useShellProject } from './shell/useShellProject';
import { useAvailableUpdate, useChangelog } from './shell/useAppUpdates';
import { CommandPalette } from './shell/palette/CommandPalette';
import { PaletteButton } from './shell/palette/PaletteButton';
import { useCommandPalette } from './shell/palette/useCommandPalette';
import './shell/shell.css';

/**
 * The frame around every screen (redesign, board 150): title bar with the path, update banner, module rail,
 * the project sidebar on project screens, and the screen. The reader keeps the title bar but drops the rail
 * and sidebar so the PDF gets the whole width. Ctrl+K or the title bar's lupa opens the command palette.
 *
 * @example <Layout><DashboardPage /></Layout>
 */
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const projectService = useProjectService();
  const { pathname } = useLocation();
  const isReader = pathname.startsWith('/articles/');
  const isFocus = isFocusRoute(pathname);
  const projectId = projectIdOf(pathname);
  const [navVersion, refreshProjectNav] = useReducer((version: number) => version + 1, 0);
  const { project, counts, documents } = useShellProject(projectId, `${pathname}#${navVersion}`);
  const updateInfo = useAvailableUpdate();
  const changelog = useChangelog();
  const palette = useCommandPalette();

  return (
    <div className={`app-frame${isReader ? ' app-frame--reader' : ''}`}>
      <AppTitleBar trail={breadcrumbTrail(pathname, project?.name)}>
        <PaletteButton onOpen={palette.open} />
      </AppTitleBar>
      <UpdateNotificationBanner
        updateInfo={updateInfo}
        onDownload={async () => {
          await projectService.downloadUpdate();
        }}
      />
      {isReader ? (
        <div className="app-frame__main--bare">{children}</div>
      ) : (
        <ProjectNavSlotProvider>
          <div className="app-frame__body">
            {!isFocus && <ModuleRail onShowChangelog={changelog.show} />}
            {projectId !== undefined && !isFocus && (
              <ProjectSidebar
                projectId={projectId}
                activeSegment={projectSegmentOf(pathname)}
                project={project}
                counts={counts}
                documents={documents}
                onQuickAccessChanged={refreshProjectNav}
              />
            )}
            <ProjectNavRefreshProvider value={refreshProjectNav}>
              <main className="app-frame__main fade-in">{children}</main>
            </ProjectNavRefreshProvider>
          </div>
        </ProjectNavSlotProvider>
      )}
      {palette.isOpen && <CommandPalette currentProjectId={projectId} onClose={palette.close} />}
      <ChangelogModal isOpen={changelog.isOpen} version={changelog.version} onClose={changelog.close} />
    </div>
  );
};
