import React from 'react';
import type { ProjectDocument } from '../../../../types';
import { useProjectService } from '../../../../contexts/ServicesContext';
import { useRefreshProjectNav } from '../../../../components/common/shell/projectNavRefresh';
import { openQuickAccessDocument } from '../../../../utils/openQuickAccessDocument';
import { QuickAccessPanel } from '../toolbar/QuickAccessPanel';

/**
 * Every quick access link of the project, grouped, on the overview (board 154); the sidebar shows only the recent
 * ones and links here. Opening one records the visit and makes the sidebar list them again.
 *
 * @example <ProjectQuickAccess documents={docs} onManage={() => modals.setIsQuickAccessModalOpen(true)} />
 */
export const ProjectQuickAccess: React.FC<{ documents: ProjectDocument[]; onManage: () => void }> = (props) => {
  const projectService = useProjectService();
  const refreshProjectNav = useRefreshProjectNav();
  return (
    <QuickAccessPanel
      documents={props.documents}
      onManage={props.onManage}
      onOpen={(doc) =>
        void openQuickAccessDocument(projectService, doc).catch(console.error).finally(refreshProjectNav)
      }
    />
  );
};
