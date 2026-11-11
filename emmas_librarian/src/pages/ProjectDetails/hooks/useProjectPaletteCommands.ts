import type { ScreenCommand } from '../../../components/common/shell/palette/PageCommandsContext';
import { SORT_OPTIONS } from '../components/articles/ArticlesToolbar';
import { STATUS_LABELS, type StatusFilter } from './articleFilters';
import type { ProjectFiltering } from './useProjectFiltering';
import type { ProjectModals } from './useProjectModals';

interface ProjectPaletteSources {
  modals: Pick<
    ProjectModals,
    'setIsCategoriesModalOpen' | 'setIsQuickAccessModalOpen' | 'setIsManualModalOpen' | 'setIsImportArticlesModalOpen'
  >;
  filtering: Pick<ProjectFiltering, 'criteria' | 'applyCriteria' | 'setSortOrder' | 'setCurrentPage'>;
  /** Opens the dialog that picks PDF files to import. */
  importPdfs: () => void;
  /** The article list is on screen: only then do sorting and the status filter mean something. */
  onArticles: boolean;
}

/**
 * The commands the project page offers the Ctrl+K palette: the windows of the project and, on the article list,
 * sorting and the status filter.
 *
 * @example projectPaletteCommands({ modals, filtering, importPdfs, onArticles: true })
 */
export function projectPaletteCommands({
  modals,
  filtering,
  importPdfs,
  onArticles,
}: ProjectPaletteSources): ScreenCommand[] {
  const always: ScreenCommand[] = [
    { id: 'project:categories', label: 'Gerenciar categorias', run: () => modals.setIsCategoriesModalOpen(true) },
    { id: 'project:quick-access', label: 'Gerenciar acesso rápido', run: () => modals.setIsQuickAccessModalOpen(true) },
    { id: 'project:manual', label: 'Adicionar artigo manualmente', run: () => modals.setIsManualModalOpen(true) },
    {
      id: 'project:import',
      label: 'Importar artigos de outro projeto',
      run: () => modals.setIsImportArticlesModalOpen(true),
    },
    { id: 'project:pdfs', label: 'Importar PDFs', run: importPdfs },
  ];
  if (!onArticles) return always;
  const sorts = SORT_OPTIONS.map(([value, label]) => ({
    id: `articles:sort:${value}`,
    label: `Artigos: ordenar por ${label.toLowerCase()}`,
    run: () => {
      filtering.setSortOrder(value);
      filtering.setCurrentPage(1);
    },
  }));
  const statuses = (Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => ({
    id: `articles:status:${status}`,
    label: `Artigos: mostrar ${STATUS_LABELS[status].toLowerCase()}`,
    run: () => filtering.applyCriteria({ ...filtering.criteria, statusFilter: status }),
  }));
  return [...always, ...sorts, ...statuses];
}
