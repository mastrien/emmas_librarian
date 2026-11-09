// The path shown in the title bar (redesign, board 150): it replaces the "Voltar aos projetos" links.

export interface Crumb {
  label: string;
  /** Where clicking it goes; the last crumb (the current screen) has none. */
  to?: string;
}

const MODULES: Record<string, string> = {
  '/new-project': 'Novo projeto',
  '/ask': 'Perguntar aos projetos',
  '/pdfs': 'Biblioteca de PDFs',
  '/agenda': 'Agenda',
  '/settings': 'Configurações',
  '/terms': 'Termos de uso e IA',
};

// Screens inside a project, by the part of the path after /projects/:id.
const PROJECT_SCREENS: Record<string, string[]> = {
  '': [],
  search: ['Nova busca'],
  investigation: ['Investigação com IA'],
  review: ['Revisão sistemática', 'Triagem'],
  'review/guided': ['Revisão sistemática', 'Triagem guiada'],
  'review/prisma': ['Revisão sistemática', 'Diagrama PRISMA'],
  'review/evaluation': ['Revisão sistemática', 'Avaliar sugestões'],
};

const HOME: Crumb = { label: 'Início', to: '/' };

function withoutLastLink(trail: Crumb[]): Crumb[] {
  return trail.map((crumb, index) => (index === trail.length - 1 ? { label: crumb.label } : crumb));
}

function projectTrail(id: string, rest: string, projectName: string | undefined): Crumb[] {
  const base = `/projects/${id}`;
  const screens = PROJECT_SCREENS[rest.startsWith('investigation') ? 'investigation' : rest] ?? [];
  const sections = screens.map((label, index) =>
    index === 0 && screens.length > 1 ? { label, to: `${base}/review` } : { label },
  );
  return [HOME, { label: projectName ?? 'Projeto', to: base }, ...sections];
}

/**
 * The crumbs for a route. The project name is passed in because it comes from the database.
 *
 * @example breadcrumbTrail('/projects/3/review/prisma', 'Chuva') // Início › Chuva › Revisão sistemática › Diagrama PRISMA
 */
export function breadcrumbTrail(pathname: string, projectName?: string): Crumb[] {
  const project = /^\/projects\/(\d+)\/?(.*)$/.exec(pathname);
  if (project) return withoutLastLink(projectTrail(project[1], project[2].replace(/\/$/, ''), projectName));
  if (pathname === '/') return [{ label: 'Início' }];
  const module = Object.keys(MODULES).find((path) => pathname === path || pathname.startsWith(`${path}/`));
  return module ? [{ label: MODULES[module] }] : [{ label: 'Início', to: '/' }];
}

/**
 * The project id in a route, if the route belongs to a project.
 *
 * @example projectIdOf('/projects/12/search') // 12
 */
export function projectIdOf(pathname: string): number | undefined {
  const match = /^\/projects\/(\d+)/.exec(pathname);
  return match ? Number(match[1]) : undefined;
}
