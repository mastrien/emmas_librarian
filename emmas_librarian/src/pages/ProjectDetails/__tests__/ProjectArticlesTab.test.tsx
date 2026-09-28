import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectArticlesTab } from '../components/ProjectArticlesTab';
import { useProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import type { Article } from '../../../types';

const article = (id: number, overrides: Partial<Article> = {}): Article =>
  ({
    id,
    project_id: 1,
    title: `Artigo ${id}`,
    authors: 'Ana',
    status: 'new',
    source_databases: '["Scopus"]',
    ...overrides,
  }) as Article;

function modalsDouble(): ProjectModals {
  const setters = [
    'setIsMassCitationModalOpen',
    'setSelectedArticleForDetails',
    'setCitationArticle',
    'setEditingArticle',
    'setArchivingId',
    'setArchivingIds',
    'setMassCitationArticles',
  ] as const;
  return Object.fromEntries(setters.map((name) => [name, vi.fn()])) as unknown as ProjectModals;
}

interface HarnessProps {
  articles: Article[];
  isSidebarOpen?: boolean;
  pageSize?: number;
}

function renderTab({ articles, isSidebarOpen = true, pageSize = 50 }: HarnessProps) {
  const handlers = {
    modals: modalsDouble(),
    onToggleSidebar: vi.fn(),
    onStatusChange: vi.fn(),
    onStatusChangeMany: vi.fn(),
    onUnlinkPdf: vi.fn(),
    onAttachPdf: vi.fn(),
  };
  // Uses the real filtering hook so the tab is exercised with the state shape the page gives it.
  function Harness() {
    const filtering = useProjectFiltering(articles, pageSize);
    return <ProjectArticlesTab filtering={filtering} isSidebarOpen={isSidebarOpen} {...handlers} />;
  }
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
  return handlers;
}

const mainList = () => screen.getByTestId('main-articles-table');
const section = (label: RegExp) => screen.getByText(label).closest('details') as HTMLElement;

describe('ProjectArticlesTab layout', () => {
  it('shows the filter bar, the sidebar and the active articles', () => {
    renderTab({ articles: [article(1)] });

    expect(screen.getByPlaceholderText('Buscar por título ou autor')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Todos,/ })).toBeInTheDocument();
    expect(within(mainList()).getByText('Artigo 1')).toBeInTheDocument();
  });

  it('hides the sidebar when closed and asks the page to toggle it', () => {
    const handlers = renderTab({ articles: [], isSidebarOpen: false });

    expect(screen.queryByRole('radio', { name: /^Todos,/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(handlers.onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('filters the list through the shared filtering state', () => {
    renderTab({ articles: [article(1, { title: 'Genes' }), article(2, { title: 'Proteínas' })] });

    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou autor'), { target: { value: 'gen' } });

    expect(within(mainList()).getByText('Genes')).toBeInTheDocument();
    expect(within(mainList()).queryByText('Proteínas')).not.toBeInTheDocument();
  });
});

describe('ProjectArticlesTab read and archived sections', () => {
  const read = article(2, { title: 'Lido', status: 'read' });
  const archived = article(3, { title: 'Arquivado', status: 'archived', archive_note: 'fora do tema' });

  it('wires the read section actions', () => {
    const { modals, onStatusChange } = renderTab({ articles: [read] });
    const readSection = within(section(/Artigos Lidos \(1\)/));

    fireEvent.click(readSection.getByRole('button', { name: 'Detalhes' }));
    fireEvent.click(readSection.getByRole('button', { name: 'Citar' }));
    fireEvent.click(readSection.getByRole('button', { name: 'Desmarcar' }));
    fireEvent.click(readSection.getByRole('button', { name: /Citação em Massa/ }));

    expect(modals.setSelectedArticleForDetails).toHaveBeenCalledWith(read);
    expect(modals.setCitationArticle).toHaveBeenCalledWith(read);
    expect(onStatusChange).toHaveBeenCalledWith(2, 'new');
    expect(modals.setIsMassCitationModalOpen).toHaveBeenCalledWith(true);
    expect(readSection.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/articles/2');
  });

  it('shows the archive reason and restores an archived article', () => {
    const { onStatusChange } = renderTab({ articles: [archived] });
    const archivedSection = within(section(/Artigos Arquivados \(1\)/));

    expect(archivedSection.getByText('Motivo: fora do tema')).toBeInTheDocument();
    fireEvent.click(archivedSection.getByRole('button', { name: 'Restaurar' }));

    expect(onStatusChange).toHaveBeenCalledWith(3, 'new');
  });

  it('omits empty sections', () => {
    renderTab({ articles: [article(1)] });

    expect(screen.queryByText(/Artigos Lidos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Artigos Arquivados/)).not.toBeInTheDocument();
  });

  it('tracks whether each section is expanded', () => {
    renderTab({ articles: [read] });
    const details = section(/Artigos Lidos \(1\)/) as HTMLDetailsElement;

    details.open = true;
    fireEvent(details, new Event('toggle'));

    expect(details.querySelector('.lucide-chevron-down')).not.toBeNull();
  });
});

describe('ProjectArticlesTab list actions', () => {
  it('forwards row actions to the page and the modals', () => {
    const withPdf = article(4, { title: 'Com PDF', local_file_path: '/a.pdf' });
    const withoutPdf = article(5, { title: 'Sem PDF' });
    const { modals, onStatusChange, onUnlinkPdf, onAttachPdf } = renderTab({
      articles: [withPdf, withoutPdf],
    });
    const row = (title: string) => within(within(mainList()).getByText(title).closest('tr') as HTMLElement);

    fireEvent.click(row('Com PDF').getByRole('button', { name: 'Mais ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Desvincular PDF' }));
    fireEvent.click(row('Sem PDF').getByTitle('Vincular PDF'));
    fireEvent.click(row('Sem PDF').getByTitle('Marcar como Lido'));
    fireEvent.click(row('Sem PDF').getByTitle('Arquivar'));
    fireEvent.click(row('Sem PDF').getByRole('button', { name: 'Mais ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar Metadados' }));

    expect(onUnlinkPdf).toHaveBeenCalledWith(4);
    expect(onAttachPdf).toHaveBeenCalledWith(5);
    expect(onStatusChange).toHaveBeenCalledWith(5, 'read');
    expect(modals.setArchivingId).toHaveBeenCalledWith(5);
    expect(modals.setEditingArticle).toHaveBeenCalledWith(withoutPdf);
  });
});

describe('ProjectArticlesTab pagination', () => {
  it('paginates active articles by the configured page size', () => {
    renderTab({ articles: [article(1), article(2), article(3)], pageSize: 2 });

    expect(screen.getByText('3 artigos')).toBeInTheDocument();
    expect(screen.getAllByText('1 / 2')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^Próxima$/ }));
    expect(screen.getAllByText('2 / 2')).toHaveLength(2);
    expect(
      within(mainList())
        .getAllByRole('row')
        .filter((r) => r.textContent?.includes('Artigo')),
    ).toHaveLength(1);
  });
});

describe('ProjectArticlesTab filter panel', () => {
  const articles = [
    article(1, { source_databases: '["Scopus"]', local_file_path: '/a.pdf' }),
    article(2, { source_databases: '["Scopus"]' }),
    article(3, { source_databases: '["OpenAlex"]', is_oa: 1 }),
  ];
  const panel = () => within(screen.getByRole('complementary', { name: 'Filtros' }));

  it('shows how many articles each option would leave', () => {
    renderTab({ articles });

    expect(panel().getByRole('checkbox', { name: 'Scopus, 2 artigos' })).toBeInTheDocument();
    expect(panel().getByRole('checkbox', { name: 'Com PDF, 1 artigo' })).toBeInTheDocument();
    expect(panel().getByRole('radio', { name: 'Lidos, 0 artigos' })).toBeInTheDocument();
  });

  it('updates the counts with the other filters and dims options that would leave nothing', () => {
    renderTab({ articles });

    fireEvent.click(panel().getByRole('checkbox', { name: /^Com PDF,/ }));

    expect(panel().getByRole('checkbox', { name: 'OpenAlex, 0 artigos' }).closest('label')).toHaveClass('is-empty');
    expect(panel().getByRole('checkbox', { name: 'Scopus, 1 artigo' }).closest('label')).not.toHaveClass('is-empty');
  });

  it('clears every filter from the panel header', () => {
    renderTab({ articles });
    fireEvent.click(panel().getByRole('checkbox', { name: /^Scopus,/ }));

    fireEvent.click(panel().getByRole('button', { name: 'Limpar' }));

    expect(panel().getByRole('checkbox', { name: /^Scopus,/ })).not.toBeChecked();
    expect(within(mainList()).getByText('Artigo 3')).toBeInTheDocument();
  });
});

describe('ProjectArticlesTab result line', () => {
  const articles = [article(1, { local_file_path: '/a.pdf', is_oa: 1 }), article(2, { is_oa: 1 }), article(3)];

  it('says how many articles the filters leave and lists them as chips', () => {
    renderTab({ articles });

    fireEvent.click(screen.getByRole('checkbox', { name: /^Acesso aberto,/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Com PDF,/ }));

    expect(screen.getByText('1 de 3 artigos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover filtro Com PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover filtro Acesso aberto' })).toBeInTheDocument();
  });

  it('removes one filter from its chip and all of them with "Limpar"', () => {
    renderTab({ articles });
    fireEvent.click(screen.getByRole('checkbox', { name: /^Acesso aberto,/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Com PDF,/ }));
    const chips = () => within(screen.getByLabelText('Filtros ativos'));

    fireEvent.click(chips().getByRole('button', { name: 'Remover filtro Com PDF' }));
    expect(screen.getByText('2 de 3 artigos')).toBeInTheDocument();

    fireEvent.click(chips().getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('3 artigos')).toBeInTheDocument();
  });
});

describe('ProjectArticlesTab multi-select', () => {
  const articles = [article(1), article(2), article(3)];
  const start = () => fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
  const bar = () => within(screen.getByRole('region', { name: 'Ações para os artigos selecionados' }));

  it('shows a checkbox per row only while selecting', () => {
    renderTab({ articles });
    expect(screen.queryByRole('checkbox', { name: 'Selecionar "Artigo 1"' })).not.toBeInTheDocument();

    start();
    expect(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 1"' })).toBeInTheDocument();

    fireEvent.click(bar().getByRole('button', { name: 'Sair da seleção' }));
    expect(screen.queryByRole('checkbox', { name: 'Selecionar "Artigo 1"' })).not.toBeInTheDocument();
  });

  it('keeps the batch actions disabled until something is selected', () => {
    renderTab({ articles });
    start();

    expect(bar().getByText('Nenhum selecionado')).toBeInTheDocument();
    expect(bar().getByRole('button', { name: /Marcar como lido/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 2"' }));
    expect(bar().getByText('1 selecionado')).toBeInTheDocument();
    expect(bar().getByRole('button', { name: /Marcar como lido/ })).toBeEnabled();
  });

  it('marks the selected articles as read in one call', () => {
    const { onStatusChangeMany } = renderTab({ articles });
    start();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 1"' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 3"' }));

    fireEvent.click(bar().getByRole('button', { name: /Marcar como lido/ }));

    // The list is ordered by "Últimos adicionados" (newest id first), and so is the selection.
    expect(onStatusChangeMany).toHaveBeenCalledWith([3, 1], 'read');
  });

  it('selects every article on the page and unselects them again', () => {
    renderTab({ articles });
    start();

    fireEvent.click(bar().getByRole('button', { name: 'Selecionar todos' }));
    expect(bar().getByText('3 selecionados')).toBeInTheDocument();

    fireEvent.click(bar().getByRole('button', { name: 'Desmarcar todos' }));
    expect(bar().getByText('Nenhum selecionado')).toBeInTheDocument();
  });

  it('asks one archive reason for all and opens the mass citation with the selection', () => {
    const { modals } = renderTab({ articles });
    start();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 1"' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 2"' }));

    fireEvent.click(bar().getByRole('button', { name: /Arquivar/ }));
    fireEvent.click(bar().getByRole('button', { name: /Citar em massa/ }));

    expect(modals.setArchivingIds).toHaveBeenCalledWith([2, 1]);
    expect(modals.setMassCitationArticles).toHaveBeenCalledWith([articles[1], articles[0]]);
    expect(modals.setIsMassCitationModalOpen).toHaveBeenCalledWith(true);
  });
});
