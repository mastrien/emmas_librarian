import { describe, expect, it, vi } from 'vitest';
import { projectPaletteCommands } from '../useProjectPaletteCommands';

const sources = (onArticles: boolean) => {
  const modals = {
    setIsCategoriesModalOpen: vi.fn(),
    setIsQuickAccessModalOpen: vi.fn(),
    setIsManualModalOpen: vi.fn(),
    setIsImportArticlesModalOpen: vi.fn(),
  };
  const filtering = {
    criteria: { statusFilter: 'all' },
    applyCriteria: vi.fn(),
    setSortOrder: vi.fn(),
    setCurrentPage: vi.fn(),
  };
  const importPdfs = vi.fn();
  return { modals, filtering, importPdfs, onArticles } as unknown as Parameters<typeof projectPaletteCommands>[0] & {
    modals: typeof modals;
    filtering: typeof filtering;
    importPdfs: typeof importPdfs;
  };
};
const find = (commands: ReturnType<typeof projectPaletteCommands>, id: string) => commands.find((c) => c.id === id)!;

describe('projectPaletteCommands', () => {
  it('opens the project windows', () => {
    const s = sources(false);
    const commands = projectPaletteCommands(s);

    find(commands, 'project:categories').run?.();
    find(commands, 'project:quick-access').run?.();
    find(commands, 'project:manual').run?.();
    find(commands, 'project:import').run?.();
    find(commands, 'project:pdfs').run?.();

    expect(s.modals.setIsCategoriesModalOpen).toHaveBeenCalledWith(true);
    expect(s.modals.setIsQuickAccessModalOpen).toHaveBeenCalledWith(true);
    expect(s.modals.setIsManualModalOpen).toHaveBeenCalledWith(true);
    expect(s.modals.setIsImportArticlesModalOpen).toHaveBeenCalledWith(true);
    expect(s.importPdfs).toHaveBeenCalledOnce();
  });

  it('offers sorting and the status filter only on the article list', () => {
    expect(projectPaletteCommands(sources(false)).some((c) => c.id.startsWith('articles:'))).toBe(false);
    expect(projectPaletteCommands(sources(true)).some((c) => c.id.startsWith('articles:'))).toBe(true);
  });

  it('sorts and goes back to the first page', () => {
    const s = sources(true);

    find(projectPaletteCommands(s), 'articles:sort:year-desc').run?.();

    expect(s.filtering.setSortOrder).toHaveBeenCalledWith('year-desc');
    expect(s.filtering.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('changes the status filter keeping the other filters', () => {
    const s = sources(true);

    find(projectPaletteCommands(s), 'articles:status:read').run?.();

    expect(s.filtering.applyCriteria).toHaveBeenCalledWith({ statusFilter: 'read' });
  });
});
