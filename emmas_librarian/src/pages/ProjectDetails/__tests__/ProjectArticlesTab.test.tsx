import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectArticlesTab } from '../components/ProjectArticlesTab';
import { useProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import type { Article } from '../../../types';
import { useOpenAccessPdfs } from '../hooks/useOpenAccessPdfs';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';

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
    'setCitationSeedArticles',
    'setEditingArticle',
    'setArchivingId',
    'setArchivingIds',
    'setMassCitationArticles',
  ] as const;
  return Object.fromEntries(setters.map((name) => [name, vi.fn()])) as unknown as ProjectModals;
}

interface HarnessProps {
  articles: Article[];
  pageSize?: number;
}

function renderTab({ articles, pageSize = 50 }: HarnessProps) {
  const handlers = {
    modals: modalsDouble(),
    onStatusChange: vi.fn(),
    onStatusChangeMany: vi.fn(),
    onUnlinkPdf: vi.fn(),
    onAttachPdf: vi.fn(),
    history: [],
    onShowHistory: vi.fn(),
  };
  const service = FakeProjectService.create();
  const reload = vi.fn(async () => undefined);
  // Uses the real filtering and open access hooks so the tab gets the state shape the page gives it.
  function Harness() {
    const filtering = useProjectFiltering(articles, pageSize);
    const openAccess = useOpenAccessPdfs(reload);
    return <ProjectArticlesTab filtering={filtering} openAccess={openAccess} {...handlers} />;
  }
  render(
    <ServicesProvider apiService={service}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { ...handlers, service, reload };
}

const mainList = () => screen.getByTestId('main-articles-table');
const status = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Status dos artigos' })).getByRole('button', { name });
// Status, reading and reference actions live in the row's "⋯" (board 153).
const chooseFromRowMenu = (title: string, item: string) => {
  const row = within(within(mainList()).getByText(title).closest('tr') as HTMLElement);
  fireEvent.click(row.getByRole('button', { name: 'Mais ações' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
};
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
const popover = () => within(screen.getByRole('dialog', { name: 'Filtros' }));

describe('ProjectArticlesTab layout', () => {
  it('shows the search, the status control and the active articles', () => {
    renderTab({ articles: [article(1)] });

    expect(screen.getByRole('searchbox', { name: 'Buscar por título ou autor' })).toBeInTheDocument();
    expect(status(/^Ativos/)).toHaveAttribute('aria-pressed', 'true');
    expect(within(mainList()).getByText('Artigo 1')).toBeInTheDocument();
  });

  it('filters the list through the shared filtering state', () => {
    renderTab({ articles: [article(1, { title: 'Genes' }), article(2, { title: 'Proteínas' })] });

    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou autor'), { target: { value: 'gen' } });

    expect(within(mainList()).getByText('Genes')).toBeInTheDocument();
    expect(within(mainList()).queryByText('Proteínas')).not.toBeInTheDocument();
  });

  // Board 153: "/" goes to the search from anywhere, but typing a "/" in a field stays a "/".
  it('focuses the search with "/" unless the user is typing', () => {
    renderTab({ articles: [article(1)] });
    const search = screen.getByRole('searchbox', { name: 'Buscar por título ou autor' });

    fireEvent.keyDown(document.body, { key: '/' });
    expect(search).toHaveFocus();

    const other = document.body.appendChild(document.createElement('input'));
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(other).toHaveFocus();
    other.remove();
  });
});

describe('ProjectArticlesTab status', () => {
  const read = article(2, { title: 'Lido', status: 'read' });
  const archived = article(3, { title: 'Arquivado', status: 'archived', archive_note: 'fora do tema' });

  it('counts each status and lists the chosen one in the same table', () => {
    renderTab({ articles: [article(1), read, archived] });

    expect(status(/^Todos/)).toHaveTextContent('Todos 3');
    fireEvent.click(status(/^Lidos/));

    expect(within(mainList()).getByText('Lido')).toBeInTheDocument();
    expect(within(mainList()).queryByText('Artigo 1')).not.toBeInTheDocument();
  });

  it('restores an archived article from its row', () => {
    const { onStatusChange } = renderTab({ articles: [archived] });

    fireEvent.click(status(/^Arquivados/));
    chooseFromRowMenu('Arquivado', 'Restaurar Artigo');

    expect(onStatusChange).toHaveBeenCalledWith(3, 'new');
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
    fireEvent.click(row('Sem PDF').getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Do computador…' }));
    chooseFromRowMenu('Sem PDF', 'Marcar como Lido');
    chooseFromRowMenu('Sem PDF', 'Arquivar');
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
    expect(screen.getByText('1–2 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('3–3 de 3')).toBeInTheDocument();
    // Body rows only: the header reads "Artigo" too.
    expect(within(mainList()).getAllByRole('row').slice(1)).toHaveLength(1);
  });
});

describe('ProjectArticlesTab filters popover', () => {
  const articles = [
    article(1, { source_databases: '["Scopus"]', local_file_path: '/a.pdf', year: 2004 }),
    article(2, { source_databases: '["Scopus"]', year: 2010 }),
    article(3, { source_databases: '["OpenAlex"]', is_oa: 1 }),
  ];

  it('opens under "Filtros" and shows how many articles each option would leave', () => {
    renderTab({ articles });
    expect(screen.queryByRole('dialog', { name: 'Filtros' })).not.toBeInTheDocument();

    openFilters();

    expect(popover().getByRole('checkbox', { name: 'Scopus, 2 artigos' })).toBeInTheDocument();
    expect(popover().getByRole('checkbox', { name: 'Com PDF, 1 artigo' })).toBeInTheDocument();
  });

  it('updates the counts with the other filters and dims options that would leave nothing', () => {
    renderTab({ articles });
    openFilters();

    fireEvent.click(popover().getByRole('checkbox', { name: /^Com PDF,/ }));

    expect(popover().getByRole('checkbox', { name: 'OpenAlex, 0 artigos' }).closest('label')).toHaveClass('is-empty');
    expect(popover().getByRole('checkbox', { name: 'Scopus, 1 artigo' }).closest('label')).not.toHaveClass('is-empty');
  });

  it('clears the filters with "Limpar" and closes with the count it leaves', () => {
    renderTab({ articles });
    openFilters();
    fireEvent.click(popover().getByRole('checkbox', { name: /^Scopus,/ }));
    expect(popover().getByRole('button', { name: 'Mostrar 2 artigos' })).toBeInTheDocument();

    fireEvent.click(popover().getByRole('button', { name: 'Limpar' }));
    fireEvent.click(popover().getByRole('button', { name: 'Mostrar 3 artigos' }));

    expect(screen.queryByRole('dialog', { name: 'Filtros' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filtros/ })).toHaveFocus();
  });

  it('closes with Escape', () => {
    renderTab({ articles });
    openFilters();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Filtros' })).not.toBeInTheDocument();
  });

  it('narrows the list to a year range typed in its fields, leaving out the articles without a year', () => {
    renderTab({ articles });
    openFilters();
    const from = popover().getByRole('spinbutton', { name: 'De' });

    fireEvent.change(from, { target: { value: '2005' } });
    fireEvent.keyDown(from, { key: 'Enter' });

    expect(within(mainList()).getByText('Artigo 2')).toBeInTheDocument();
    expect(within(mainList()).queryByText('Artigo 1')).not.toBeInTheDocument();
    expect(within(mainList()).queryByText('Artigo 3')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover filtro desde 2005' })).toBeInTheDocument();

    fireEvent.click(popover().getByRole('checkbox', { name: 'Incluir os 1 artigos sem ano' }));
    expect(within(mainList()).getByText('Artigo 3')).toBeInTheDocument();
  });
});

describe('ProjectArticlesTab active filter chips', () => {
  const articles = [article(1, { local_file_path: '/a.pdf', is_oa: 1 }), article(2, { is_oa: 1 }), article(3)];
  const chooseTwoFilters = () => {
    openFilters();
    fireEvent.click(popover().getByRole('checkbox', { name: /^Acesso aberto,/ }));
    fireEvent.click(popover().getByRole('checkbox', { name: /^Com PDF,/ }));
  };

  it('says how many articles the filters leave and lists them as chips beside "Filtros"', () => {
    renderTab({ articles });

    chooseTwoFilters();

    expect(screen.getByText('1 de 3 artigos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros (2 ativos)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover filtro Com PDF' })).toBeInTheDocument();
  });

  it('removes one filter from its chip and all of them with "Limpar"', () => {
    renderTab({ articles });
    chooseTwoFilters();
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

  // Validation of epic #44: "Selecionar todos" took only the page, so a batch meant going page by page.
  it('selects every article of the filtered list, on every page, and unselects them again', () => {
    renderTab({ articles, pageSize: 1 });
    start();

    fireEvent.click(bar().getByRole('button', { name: 'Selecionar todos' }));
    expect(bar().getByText('3 selecionados')).toBeInTheDocument();

    fireEvent.click(bar().getByRole('button', { name: 'Desmarcar todos' }));
    expect(bar().getByText('Nenhum selecionado')).toBeInTheDocument();
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

describe('ProjectArticlesTab open access PDFs', () => {
  const findOpenCopy = (title: string) => {
    const row = within(within(mainList()).getByText(title).closest('tr') as HTMLElement);
    fireEvent.click(row.getByRole('button', { name: 'Vincular PDF' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Buscar PDF aberto' }));
    return row;
  };

  it('shows a blocked copy on the row, with the page to download in the browser', async () => {
    const { service } = renderTab({ articles: [article(1, { doi: '10.1056/x' })] });
    service.fetchOpenAccessPdf.mockResolvedValue({ status: 'blocked', landingPages: ['https://doi.org/10.1056/x'] });

    const row = findOpenCopy('Artigo 1');

    expect(
      await row.findByText('Há cópia aberta, mas o download automático não funcionou.', { exact: false }),
    ).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'Abrir a página' })).toHaveAttribute('href', 'https://doi.org/10.1056/x');
    expect(service.fetchOpenAccessPdf).toHaveBeenCalledWith(1);
  });

  it('says it is searching, then reloads the articles when the PDF came in', async () => {
    const { service, reload } = renderTab({ articles: [article(1)] });
    let answer: (o: { status: 'downloaded'; source: string }) => void = () => undefined;
    service.fetchOpenAccessPdf.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const row = findOpenCopy('Artigo 1');
    expect(row.getByRole('status', { name: 'Buscando PDF…' })).toBeInTheDocument();
    answer({ status: 'downloaded', source: 'PubMed Central' });

    expect(await row.findByText('PDF baixado. Fonte: PubMed Central.')).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
  });

  it('downloads a selection one article at a time and ends with a report of what needs the user', async () => {
    const { service, reload } = renderTab({ articles: [article(1), article(2), article(3)] });
    service.fetchOpenAccessPdf
      .mockResolvedValueOnce({ status: 'already' })
      .mockResolvedValueOnce({ status: 'blocked', landingPages: ['https://doi.org/b'] })
      .mockResolvedValueOnce({ status: 'downloaded', source: 'arXiv' });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    const bar = within(screen.getByRole('region', { name: 'Ações para os artigos selecionados' }));
    fireEvent.click(bar.getByRole('button', { name: 'Selecionar todos' }));

    fireEvent.click(bar.getByRole('button', { name: /Baixar PDFs abertos/ }));

    const report = within(await screen.findByRole('dialog', { name: /PDFs abertos: 1 de 3 baixados/ }));
    expect(report.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual([
      'Baixados (1)',
      'Precisam de você (1)',
      'Já tinham PDF (1)',
    ]);
    expect(report.getByRole('link', { name: 'Abrir a página' })).toHaveAttribute('href', 'https://doi.org/b');
    expect(service.fetchOpenAccessPdf.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2, 3]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the progress in the bar and stops after the current article when cancelled', async () => {
    const { service, reload } = renderTab({ articles: [article(1), article(2), article(3)] });
    let answer: (o: { status: 'not-open' }) => void = () => undefined;
    service.fetchOpenAccessPdf.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    const bar = within(screen.getByRole('region', { name: 'Ações para os artigos selecionados' }));
    fireEvent.click(bar.getByRole('button', { name: 'Selecionar todos' }));
    fireEvent.click(bar.getByRole('button', { name: /Baixar PDFs abertos/ }));

    expect(bar.getByRole('status')).toHaveTextContent('Baixando 1 de 3…');
    fireEvent.click(bar.getByRole('button', { name: 'Cancelar' }));
    answer({ status: 'not-open' });

    expect(await screen.findByRole('dialog', { name: /cancelado; 2 não tentados/ })).toBeInTheDocument();
    expect(service.fetchOpenAccessPdf).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('closes the report', async () => {
    const { service } = renderTab({ articles: [article(1)] });
    service.fetchOpenAccessPdf.mockResolvedValue({ status: 'no-doi' });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    const bar = within(screen.getByRole('region', { name: 'Ações para os artigos selecionados' }));
    fireEvent.click(bar.getByRole('button', { name: 'Selecionar todos' }));
    fireEvent.click(bar.getByRole('button', { name: /Baixar PDFs abertos/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// Board 153 footer: "J K linha · Enter abrir · X selecionar".
describe('ProjectArticlesTab keyboard', () => {
  const press = (key: string) => fireEvent.keyDown(document.body, { key });
  const currentRow = () =>
    within(mainList())
      .getAllByRole('row')
      .find((r) => r.classList.contains('is-current'));

  // Newest first by default: Artigo 2, then Artigo 1.
  it('moves the current row with J and K, stopping at the ends', () => {
    renderTab({ articles: [article(1), article(2)] });

    press('j');
    expect(currentRow()).toHaveTextContent('Artigo 2');
    press('j');
    press('j');
    expect(currentRow()).toHaveTextContent('Artigo 1');
    press('k');
    press('k');
    expect(currentRow()).toHaveTextContent('Artigo 2');
  });

  it('opens the details of the current row with Enter when it has no PDF', () => {
    const { modals } = renderTab({ articles: [article(1, { title: 'Sem PDF' })] });

    press('j');
    press('Enter');

    expect(modals.setSelectedArticleForDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('leaves Enter to a focused button, like the row menu reached with Tab', () => {
    const { modals } = renderTab({ articles: [article(1)] });
    press('j');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Mais ações' }), { key: 'Enter' });

    expect(modals.setSelectedArticleForDetails).not.toHaveBeenCalled();
  });

  it('selects the current row with X, starting multi-select', () => {
    renderTab({ articles: [article(1)] });

    press('j');
    press('x');

    expect(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 1"' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Sair da seleção/, pressed: true })).toBeInTheDocument();
  });

  it('leaves the keys alone while the user types in a field', () => {
    renderTab({ articles: [article(1)] });
    const search = screen.getByRole('searchbox', { name: 'Buscar por título ou autor' });

    fireEvent.keyDown(search, { key: 'j' });

    expect(currentRow()).toBeUndefined();
  });
});

describe('ProjectArticlesTab "Selecionar"', () => {
  it('turns multi-select on and off from the toolbar', () => {
    renderTab({ articles: [article(1)] });

    fireEvent.click(screen.getByRole('button', { name: /^Selecionar$/ }));
    expect(screen.getByRole('checkbox', { name: 'Selecionar "Artigo 1"' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sair da seleção/, pressed: true }));
    expect(screen.queryByRole('checkbox', { name: 'Selecionar "Artigo 1"' })).not.toBeInTheDocument();
  });
});
