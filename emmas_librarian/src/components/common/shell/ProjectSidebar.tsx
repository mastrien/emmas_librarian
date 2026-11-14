import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, History, LayoutDashboard, ListChecks, Search, Sparkles, Tags } from 'lucide-react';
import type { Project, ProjectDocument, ProjectNavCounts } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { openQuickAccessDocument } from '../../../utils/openQuickAccessDocument';
import { ManageQuickAccessModal } from '../../modals/ManageQuickAccessModal';
import { PROJECT_NAV, type ProjectNavItem } from './projectNav';
import { QuickAccessRecents } from './QuickAccessRecents';
import { ProjectNavSlotHost } from './projectNavSlot';

const ICONS: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard size={16} />,
  articles: <FileText size={16} />,
  categories: <Tags size={16} />,
  diary: <BookOpen size={16} />,
  search: <Search size={16} />,
  history: <History size={16} />,
  review: <ListChecks size={16} />,
  investigation: <Sparkles size={16} />,
};

interface SidebarItemProps {
  item: ProjectNavItem;
  base: string;
  isActive: boolean;
  counts?: ProjectNavCounts;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, base, isActive, counts }) => (
  <Link
    to={`${base}/${item.segment}`}
    className={`project-nav__item${isActive ? ' is-active' : ''}`}
    aria-current={isActive ? 'page' : undefined}
    data-testid={item.testId}
    title={item.label}
  >
    {ICONS[item.segment]}
    <span className="project-nav__label">{item.label}</span>
    {/* The space keeps screen readers from reading "Artigos96"; the flex gap does the visual spacing. */}
    {item.count && counts && (
      <>
        {' '}
        <span className="project-nav__count">{counts[item.count]}</span>
      </>
    )}
  </Link>
);

const sinceDate = (createdAt: string): string => new Date(createdAt).toLocaleDateString('pt-BR');

const SidebarHead: React.FC<{ project?: Project; counts?: ProjectNavCounts }> = ({ project, counts }) => (
  <div className="project-nav__head">
    <span className="project-nav__eyebrow">Projeto</span>
    <span className="project-nav__name">{project?.name ?? ' '}</span>
    {project && counts && (
      <span className="project-nav__meta">
        {counts.articles} {counts.articles === 1 ? 'artigo' : 'artigos'} · desde {sinceDate(project.created_at)}
      </span>
    )}
  </div>
);

interface ProjectSidebarProps {
  projectId: number;
  /** First path segment after /projects/:id (see projectSegmentOf). */
  activeSegment?: string;
  project?: Project;
  counts?: ProjectNavCounts;
  documents?: ProjectDocument[];
  /** Called after a link is opened or the links are edited, so the shell reloads them. */
  onQuickAccessChanged: () => void;
}

/**
 * The project's own navigation (redesign, board 150), next to the module rail on every project screen:
 * sections of the project page, search and analysis screens, with counts, and the recent quick access links.
 *
 * @example <ProjectSidebar projectId={3} activeSegment="articles" project={project} counts={counts} documents={docs} onQuickAccessChanged={reload} />
 */
export const ProjectSidebar: React.FC<ProjectSidebarProps> = (props) => (
  <aside className="project-nav" aria-label="Projeto">
    <SidebarSections {...props} />
    <SidebarQuickAccess {...props} />
  </aside>
);

const SidebarSections: React.FC<ProjectSidebarProps> = ({ projectId, activeSegment, project, counts }) => (
  <>
    <SidebarHead project={project} counts={counts} />
    {PROJECT_NAV.map((group, index) => (
      <nav key={group.title ?? index} className="project-nav__group" aria-label={group.title ?? 'Seções do projeto'}>
        {group.title && <span className="project-nav__eyebrow">{group.title}</span>}
        {group.items.map((item) => (
          <React.Fragment key={item.segment}>
            <SidebarItem
              item={item}
              base={`/projects/${projectId}`}
              isActive={item.segment === activeSegment}
              counts={counts}
            />
            {item.slot && item.segment === activeSegment && <ProjectNavSlotHost />}
          </React.Fragment>
        ))}
      </nav>
    ))}
  </>
);

const SidebarQuickAccess: React.FC<ProjectSidebarProps> = ({ projectId, documents = [], onQuickAccessChanged }) => {
  const projectService = useProjectService();
  const [isManaging, setIsManaging] = useState(false);
  const open = (doc: ProjectDocument) =>
    void openQuickAccessDocument(projectService, doc).catch(console.error).finally(onQuickAccessChanged);
  return (
    <>
      <QuickAccessRecents
        projectId={projectId}
        documents={documents}
        onOpen={open}
        onManage={() => setIsManaging(true)}
      />
      {/* Mounted only while open: the modal keeps its own copy of the links for drag-and-drop. */}
      {isManaging && (
        <ManageQuickAccessModal
          isOpen
          onClose={() => setIsManaging(false)}
          projectId={projectId}
          documents={documents}
          onDocumentsChanged={onQuickAccessChanged}
        />
      )}
    </>
  );
};
