import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChangelogModal } from '../modals/ChangelogModal';
import { UpdateNotificationBanner } from './UpdateNotificationBanner';
import { useProjectService } from '../../contexts/ServicesContext';
import { AppTitleBar } from './shell/AppTitleBar';
import { ModuleRail } from './shell/ModuleRail';
import { breadcrumbTrail, projectIdOf } from './shell/breadcrumbs';
import { useProjectName } from './shell/useProjectName';
import { useAvailableUpdate, useChangelog } from './shell/useAppUpdates';
import './shell/shell.css';

/**
 * The frame around every screen (redesign, board 150): title bar with the path, update banner, module rail
 * and the screen. The reader keeps the title bar but drops the rail so the PDF gets the whole width.
 *
 * @example <Layout><DashboardPage /></Layout>
 */
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const projectService = useProjectService();
  const { pathname } = useLocation();
  const isReader = pathname.startsWith('/articles/');
  const projectName = useProjectName(projectIdOf(pathname), pathname);
  const updateInfo = useAvailableUpdate();
  const changelog = useChangelog();

  return (
    <div className={`app-frame${isReader ? ' app-frame--reader' : ''}`}>
      <AppTitleBar trail={breadcrumbTrail(pathname, projectName)} />
      <UpdateNotificationBanner
        updateInfo={updateInfo}
        onDownload={async () => {
          await projectService.downloadUpdate();
        }}
      />
      {isReader ? (
        <div className="app-frame__main--bare">{children}</div>
      ) : (
        <div className="app-frame__body">
          <ModuleRail onShowChangelog={changelog.show} />
          <main className="app-frame__main fade-in">{children}</main>
        </div>
      )}
      <ChangelogModal isOpen={changelog.isOpen} version={changelog.version} onClose={changelog.close} />
    </div>
  );
};
