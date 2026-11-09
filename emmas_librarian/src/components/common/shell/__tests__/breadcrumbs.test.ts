import { describe, it, expect } from 'vitest';
import { breadcrumbTrail, projectIdOf } from '../breadcrumbs';

describe('breadcrumbTrail', () => {
  it('shows only "Início", not linked, on the home screen', () => {
    expect(breadcrumbTrail('/')).toEqual([{ label: 'Início' }]);
  });

  it('names a module screen on its own', () => {
    expect(breadcrumbTrail('/settings')).toEqual([{ label: 'Configurações' }]);
    expect(breadcrumbTrail('/ask/7')).toEqual([{ label: 'Perguntar aos projetos' }]);
  });

  it('links home and the project on a project screen, leaving the current one unlinked', () => {
    expect(breadcrumbTrail('/projects/3/search', 'Chuva')).toEqual([
      { label: 'Início', to: '/' },
      { label: 'Chuva', to: '/projects/3' },
      { label: 'Nova busca' },
    ]);
  });

  it('unlinks the project when it is the current screen', () => {
    expect(breadcrumbTrail('/projects/3', 'Chuva')).toEqual([{ label: 'Início', to: '/' }, { label: 'Chuva' }]);
  });

  it('links the review section from its sub-screens', () => {
    expect(breadcrumbTrail('/projects/3/review/prisma', 'Chuva')).toEqual([
      { label: 'Início', to: '/' },
      { label: 'Chuva', to: '/projects/3' },
      { label: 'Revisão sistemática', to: '/projects/3/review' },
      { label: 'Diagrama PRISMA' },
    ]);
  });

  it('keeps every investigation view under one crumb', () => {
    expect(breadcrumbTrail('/projects/3/investigation/5', 'Chuva').map((c) => c.label)).toEqual([
      'Início',
      'Chuva',
      'Investigação com IA',
    ]);
  });

  it('names the project page section after the project', () => {
    expect(breadcrumbTrail('/projects/3/history', 'Chuva')).toEqual([
      { label: 'Início', to: '/' },
      { label: 'Chuva', to: '/projects/3' },
      { label: 'Histórico de buscas' },
    ]);
  });

  it('says "Projeto" while the name has not loaded', () => {
    expect(breadcrumbTrail('/projects/3')[1]).toEqual({ label: 'Projeto' });
  });

  it('falls back to a link home on an unknown route', () => {
    expect(breadcrumbTrail('/nowhere')).toEqual([{ label: 'Início', to: '/' }]);
  });
});

describe('projectIdOf', () => {
  it('reads the project id of a project route', () => {
    expect(projectIdOf('/projects/12/search')).toBe(12);
  });

  it('is undefined outside a project', () => {
    expect(projectIdOf('/agenda')).toBeUndefined();
  });
});
