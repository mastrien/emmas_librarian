import type { Article, Project } from '../../../../types';
import { RAIL_MODULES, SETTINGS_MODULE } from '../modules';
import { PROJECT_NAV } from '../projectNav';
import { SETTINGS_SECTIONS } from '../../../../pages/Settings/settingsSections';

// Ctrl+K (redesign, board 150 and the "Teclado primeiro" rule of the canvas): one box to go anywhere, find an
// article of the current project, or start a common action. A command either goes to a route or runs
// something the open screen registered (new entry, sort by year, …).

export type PaletteGroup = 'Nesta tela' | 'Ir para' | 'Projeto atual' | 'Projetos' | 'Artigos' | 'Executar';

export interface PaletteCommand {
  id: string;
  group: PaletteGroup;
  label: string;
  /** Shown after the label, and searched with it (authors and year of an article). */
  hint?: string;
  /** Where the command goes; commands of the open screen carry `run` instead. */
  to?: string;
  /** What the command does, for the ones a screen registers (new entry, sort by year, …). */
  run?: () => void;
}

export interface PaletteSources {
  projects: Pick<Project, 'id' | 'name'>[];
  currentProjectId?: number;
  articles: Pick<Article, 'id' | 'title' | 'authors' | 'year'>[];
}

const moduleCommands = (): PaletteCommand[] =>
  [...RAIL_MODULES, SETTINGS_MODULE].map((m) => ({
    id: `module:${m.key}`,
    group: 'Ir para',
    label: m.label,
    to: m.to,
  }));

const sectionCommands = (projectId: number): PaletteCommand[] =>
  PROJECT_NAV.flatMap((group) => group.items).map((item) => ({
    id: `section:${item.segment}`,
    group: 'Projeto atual',
    label: item.label,
    to: `/projects/${projectId}/${item.segment}`,
  }));

const projectCommands = (projects: PaletteSources['projects']): PaletteCommand[] =>
  projects.map((p) => ({ id: `project:${p.id}`, group: 'Projetos', label: p.name, to: `/projects/${p.id}` }));

const articleCommands = (articles: PaletteSources['articles']): PaletteCommand[] =>
  articles.map((a) => ({
    id: `article:${a.id}`,
    group: 'Artigos',
    label: a.title,
    hint: [a.authors, a.year].filter(Boolean).join(' · ') || undefined,
    to: `/articles/${a.id}`,
  }));

const settingsCommands = (): PaletteCommand[] =>
  SETTINGS_SECTIONS.map((s) => ({
    id: `settings:${s.id}`,
    group: 'Ir para',
    label: `Configurações › ${s.label}`,
    to: `/settings/${s.id}`,
  }));

const projectToolCommands = (id: number): PaletteCommand[] =>
  [
    ['search', 'Nova busca', `/projects/${id}/search`],
    ['investigation-new', 'Nova investigação', `/projects/${id}/investigation/new`],
    ['evaluation', 'Avaliar sugestões da IA', `/projects/${id}/review/evaluation`],
  ].map(([key, label, to]) => ({ id: `tool:${key}`, group: 'Projeto atual', label, to }));

const actionCommands = (projectId?: number): PaletteCommand[] => [
  { id: 'action:new-project', group: 'Executar', label: 'Criar projeto', to: '/new-project' },
  { id: 'action:terms', group: 'Ir para', label: 'Termos de uso e IA', to: '/terms' },
  ...(projectId === undefined
    ? []
    : [
        {
          id: 'action:guided',
          group: 'Executar' as const,
          label: 'Triagem guiada',
          to: `/projects/${projectId}/review/guided`,
        },
        {
          id: 'action:prisma',
          group: 'Executar' as const,
          label: 'Diagrama PRISMA',
          to: `/projects/${projectId}/review/prisma`,
        },
      ]),
];

/**
 * Every command the palette can offer for the current context, in display order.
 *
 * @example buildPaletteCommands({ projects, currentProjectId: 3, articles })
 */
export function buildPaletteCommands(sources: PaletteSources, screenCommands: PaletteCommand[] = []): PaletteCommand[] {
  const { currentProjectId: id } = sources;
  // What the open screen offers comes first; the app-wide ones it registered (news, help) sit with the places.
  const here = screenCommands.filter((c) => c.group === 'Nesta tela');
  const everywhere = screenCommands.filter((c) => c.group !== 'Nesta tela');
  return [
    ...here,
    ...(id === undefined ? [] : [...sectionCommands(id), ...projectToolCommands(id)]),
    ...moduleCommands(),
    ...everywhere,
    ...settingsCommands(),
    ...projectCommands(sources.projects.filter((p) => p.id !== id)),
    ...actionCommands(id),
    ...articleCommands(sources.articles),
  ];
}

/**
 * Lower case without accents, so "previsao" finds "Previsão".
 *
 * @example normalizeForSearch('Previsão Climática') // 'previsao climatica'
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const EMPTY_QUERY_GROUPS: readonly PaletteGroup[] = ['Nesta tela', 'Projeto atual', 'Ir para', 'Executar'];

/**
 * The commands whose label or hint contain every word typed, labels starting with the query first. With an
 * empty query, only places and actions: listing every project and article would bury them.
 *
 * @example filterPaletteCommands(commands, 'agen') // [{ label: 'Agenda', … }]
 */
export function filterPaletteCommands(commands: PaletteCommand[], query: string, limit = 60): PaletteCommand[] {
  const typed = normalizeForSearch(query.trim());
  if (!typed) return commands.filter((c) => EMPTY_QUERY_GROUPS.includes(c.group)).slice(0, limit);
  const words = typed.split(/\s+/);
  const matches = commands.filter((c) => {
    const text = normalizeForSearch(`${c.label} ${c.hint ?? ''}`);
    return words.every((word) => text.includes(word));
  });
  const startsWithQuery = (c: PaletteCommand) => (normalizeForSearch(c.label).startsWith(typed) ? 0 : 1);
  return [...matches].sort((a, b) => startsWithQuery(a) - startsWithQuery(b)).slice(0, limit);
}
