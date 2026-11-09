import type { ProjectNavCounts } from '../../../types';

// The project sidebar (redesign, board 150). Its first group used to be the tab strip of the project page; each
// tab is now a route, so the sidebar can light the right item from any project screen and a reload keeps it.

export type ProjectSection = 'overview' | 'articles' | 'categories' | 'diary' | 'history';

const SECTIONS: readonly string[] = ['overview', 'articles', 'categories', 'diary', 'history'];

/** Where /projects/:id lands when this session has not opened a section of the project yet. */
export const DEFAULT_PROJECT_SECTION: ProjectSection = 'articles';

/**
 * True for the segments the project page shows itself (the rest are screens of their own).
 *
 * @example isProjectSection('diary') // true; isProjectSection('search') // false
 */
export function isProjectSection(segment: string | undefined): segment is ProjectSection {
  return segment !== undefined && SECTIONS.includes(segment);
}

export interface ProjectNavItem {
  /** First path segment after /projects/:id; also what lights the item. */
  segment: string;
  label: string;
  count?: keyof ProjectNavCounts;
  /** The old tab test ids, kept so the E2E specs that open a section still find it. */
  testId?: string;
}

export interface ProjectNavGroup {
  title?: string;
  items: ProjectNavItem[];
}

export const PROJECT_NAV: readonly ProjectNavGroup[] = [
  {
    items: [
      { segment: 'overview', label: 'Visão geral', testId: 'tab-overview' },
      { segment: 'articles', label: 'Artigos', count: 'articles', testId: 'tab-articles' },
      { segment: 'categories', label: 'Categorias', count: 'categories', testId: 'tab-categories' },
      { segment: 'diary', label: 'Diário', testId: 'tab-diary' },
    ],
  },
  {
    title: 'Busca',
    items: [
      { segment: 'search', label: 'Nova busca' },
      { segment: 'history', label: 'Histórico', count: 'searches', testId: 'tab-history' },
    ],
  },
  {
    title: 'Análise',
    items: [
      { segment: 'review', label: 'Revisão sistemática' },
      { segment: 'investigation', label: 'Investigação com IA', count: 'investigations' },
    ],
  },
];

/**
 * The first segment after /projects/:id, which names the lit sidebar item ('review' for every review screen).
 * Undefined outside a project or on the bare project path.
 *
 * @example projectSegmentOf('/projects/3/review/prisma') // 'review'
 */
export function projectSegmentOf(pathname: string): string | undefined {
  const match = /^\/projects\/\d+\/([^/]+)/.exec(pathname);
  return match?.[1];
}
