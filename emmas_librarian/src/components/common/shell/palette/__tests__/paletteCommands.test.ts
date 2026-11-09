import { describe, it, expect } from 'vitest';
import { buildPaletteCommands, filterPaletteCommands, normalizeForSearch } from '../paletteCommands';

const projects = [
  { id: 3, name: 'Previsão Climática' },
  { id: 4, name: 'Soft sensors' },
];
const articles = [
  { id: 10, title: 'Deep learning for rainfall nowcasting', authors: 'Lima, A.', year: 2024 },
  { id: 11, title: 'Soft sensor review', authors: 'Souza, B.', year: 2019 },
];

describe('buildPaletteCommands', () => {
  it('offers the current project sections first, without that project among the others', () => {
    const commands = buildPaletteCommands({ projects, currentProjectId: 3, articles: [] });

    expect(commands[0]).toMatchObject({ group: 'Projeto atual', label: 'Visão geral', to: '/projects/3/overview' });
    expect(commands.filter((c) => c.group === 'Projetos').map((c) => c.label)).toEqual(['Soft sensors']);
  });

  it('has no project sections nor project actions outside a project', () => {
    const commands = buildPaletteCommands({ projects, articles: [] });

    expect(commands.some((c) => c.group === 'Projeto atual')).toBe(false);
    expect(commands.filter((c) => c.group === 'Executar').map((c) => c.label)).toEqual(['Criar projeto']);
  });

  it('opens an article in the reader and describes it by authors and year', () => {
    const commands = buildPaletteCommands({ projects, currentProjectId: 3, articles });

    expect(commands.find((c) => c.id === 'article:10')).toMatchObject({ to: '/articles/10', hint: 'Lima, A. · 2024' });
  });
});

describe('normalizeForSearch', () => {
  it('drops accents and case', () => {
    expect(normalizeForSearch('Previsão Climática')).toBe('previsao climatica');
  });
});

describe('filterPaletteCommands', () => {
  const commands = buildPaletteCommands({ projects, currentProjectId: 3, articles });

  it('shows only places and actions before anything is typed', () => {
    const groups = new Set(filterPaletteCommands(commands, '').map((c) => c.group));

    expect(groups).toEqual(new Set(['Projeto atual', 'Ir para', 'Executar']));
  });

  it('matches every typed word, accents ignored, in the label or the hint', () => {
    expect(filterPaletteCommands(commands, 'souza 2019').map((c) => c.id)).toEqual(['article:11']);
    expect(filterPaletteCommands(commands, 'revisao sist').map((c) => c.label)).toEqual(['Revisão sistemática']);
  });

  it('ranks labels that start with the query first', () => {
    const labels = filterPaletteCommands(commands, 'soft').map((c) => c.label);

    expect(labels[0]).toBe('Soft sensors');
    expect(labels).toContain('Soft sensor review');
  });

  it('stops at the limit', () => {
    expect(filterPaletteCommands(commands, 'a', 3)).toHaveLength(3);
  });
});
