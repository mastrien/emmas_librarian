// The app's top-level modules, shown in the rail (redesign, board 150). Projects live under "Início".

export type ModuleKey = 'home' | 'ask' | 'pdfs' | 'agenda' | 'settings';

export interface RailModule {
  key: ModuleKey;
  to: string;
  label: string;
}

/** Main modules, top of the rail; settings sits apart at the bottom. */
export const RAIL_MODULES: RailModule[] = [
  { key: 'home', to: '/', label: 'Início' },
  { key: 'ask', to: '/ask', label: 'Perguntar aos projetos' },
  { key: 'pdfs', to: '/pdfs', label: 'Biblioteca de PDFs' },
  { key: 'agenda', to: '/agenda', label: 'Agenda' },
];

export const SETTINGS_MODULE: RailModule = { key: 'settings', to: '/settings', label: 'Configurações' };

const PREFIXES: [string, ModuleKey][] = [
  ['/ask', 'ask'],
  ['/pdfs', 'pdfs'],
  ['/agenda', 'agenda'],
  ['/settings', 'settings'],
];

/**
 * Which rail item is lit for a route. Projects, new project and the reader count as "Início".
 *
 * @example activeModule('/projects/4/review') // 'home'
 */
export function activeModule(pathname: string): ModuleKey | undefined {
  const match = PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (match) return match[1];
  if (pathname === '/' || /^\/(projects|articles|new-project)(\/|$)/.test(pathname)) return 'home';
  return undefined;
}
