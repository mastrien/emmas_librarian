import { useEffect, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { UpdateInfoPayload } from '../../../types';

/**
 * The available update, if any, kept current by the main process. Drives the banner under the title bar.
 *
 * @example const updateInfo = useAvailableUpdate();
 */
export function useAvailableUpdate(): UpdateInfoPayload | null {
  const projectService = useProjectService();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfoPayload | null>(null);

  useEffect(() => {
    projectService
      .getUpdateStatus()
      .then((res) => res.status === 'available' && setUpdateInfo(res.updateInfo))
      .catch(console.error);
    const unsubscribe = projectService.onUpdateStatusChange((res) =>
      setUpdateInfo(res.status === 'available' ? res.updateInfo : null),
    );
    return () => unsubscribe();
  }, [projectService]);

  return updateInfo;
}

const LAST_SEEN_KEY = 'last_seen_version';

export interface ChangelogState {
  isOpen: boolean;
  version: string;
  show: () => void;
  close: () => void;
}

/**
 * Opens the release notes once after each new version; "close" remembers the version as seen.
 *
 * @example const changelog = useChangelog(); <ChangelogModal isOpen={changelog.isOpen} onClose={changelog.close} … />
 */
export function useChangelog(): ChangelogState {
  const projectService = useProjectService();
  const [isOpen, setIsOpen] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    projectService
      .getAppVersion()
      .then((current) => {
        setVersion(current);
        if (localStorage.getItem(LAST_SEEN_KEY) !== current) setIsOpen(true);
      })
      .catch((err) => console.error('Failed to check app version:', err));
  }, [projectService]);

  const close = () => {
    localStorage.setItem(LAST_SEEN_KEY, version);
    setIsOpen(false);
  };

  return { isOpen, version, show: () => setIsOpen(true), close };
}
