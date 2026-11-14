import React from 'react';
import type { Article, ProjectDocument } from '../../../../types';
import { ProjectAboutEditor } from './ProjectAboutEditor';
import { ProjectQuickAccess } from './ProjectQuickAccess';
import { OverviewStats } from './OverviewStats';
import './overview.css';

interface ProjectOverviewProps {
  projectId: number;
  articles: Article[];
  documents: ProjectDocument[];
  onManageQuickAccess: () => void;
}

/**
 * The project's start page (board 154): every quick access link above "Sobre o projeto" on the left, the compact
 * numbers on the right; one column on narrow windows, the page first.
 *
 * @example <ProjectOverview projectId={3} articles={articles} documents={docs} onManageQuickAccess={open} />
 */
export const ProjectOverview: React.FC<ProjectOverviewProps> = (props) => (
  <div className="overview">
    <div className="overview-main">
      <ProjectQuickAccess documents={props.documents} onManage={props.onManageQuickAccess} />
      <ProjectAboutEditor projectId={props.projectId} />
    </div>
    <OverviewStats articles={props.articles} />
  </div>
);
