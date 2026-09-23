import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectArticlesTab } from '../components/ProjectArticlesTab';
import { useProjectFiltering } from '../hooks/useProjectFiltering';
import type { ProjectModals } from '../hooks/useProjectModals';
import type { Article } from '../../../types';

const article = (id: number, overrides: Partial<Article> = {}): Article =>
  ({ id, project_id: 1, title: `Artigo ${id}`, authors: 'Ana', status: 'new', source_databases: '["Scopus"]', ...overrides }) as Article;

function modalsDouble(): ProjectModals {
  const setters = [
    'setIsMassCitationModalOpen',
    'setSelectedArticleForDetails',
    'setCitationArticle',
    'setEditingArticle',
    'setArchivingId',
  ] as const;
  return Object.fromEntries(setters.map((name) => [name, vi.fn()])) as unknown as ProjectModals;
}

interface HarnessProps {
  articles: Article[];
  isSidebarOpen?: boolean;
  isArticleManual?: (article: Article) => boolean;
  pageSize?: number;
}

function renderTab({ articles, isSidebarOpen = true, isArticleManual = () => false, pageSize = 50 }: HarnessProps) {
  const handlers = {
    modals: modalsDouble(),
    onToggleSidebar: vi.fn(),
    onStatusChange: vi.fn(),
    onUnlinkPdf: vi.fn(),
    onAttachPdf: vi.fn(),
  };
  // Uses the real filtering hook so the tab is exercised with the state shape the page gives it.
  function Harness() {
    const filtering = useProjectFiltering(articles, pageSize);
    return <ProjectArticlesTab filtering={filtering} isSidebarOpen={isSidebarOpen} isArticleManual={isArticleManual} {...handlers} />;
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

    expect(screen.getByPlaceholderText('Filtrar por título ou autor...')).toBeInTheDocument();
    expect(screen.getByLabelText('Todos')).toBeInTheDocument();
    expect(within(mainList()).getByText('Artigo 1')).toBeInTheDocument();
  });

  it('hides the sidebar when closed and asks the page to toggle it', () => {
    const handlers = renderTab({ articles: [], isSidebarOpen: false });

    expect(screen.queryByLabelText('Todos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(handlers.onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('filters the list through the shared filtering state', () => {
    renderTab({ articles: [article(1, { title: 'Genes' }), article(2, { title: 'Proteínas' })] });

    fireEvent.change(screen.getByPlaceholderText('Filtrar por título ou autor...'), { target: { value: 'gen' } });

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
    const { modals, onStatusChange, onUnlinkPdf, onAttachPdf } = renderTab({ articles: [withPdf, withoutPdf], isArticleManual: () => true });
    const row = (title: string) => within(within(mainList()).getByText(title).closest('tr') as HTMLElement);

    fireEvent.click(row('Com PDF').getByTitle('Desvincular PDF'));
    fireEvent.click(row('Sem PDF').getByTitle('Vincular PDF'));
    fireEvent.click(row('Sem PDF').getByTitle('Marcar como Lido'));
    fireEvent.click(row('Sem PDF').getByTitle('Arquivar'));
    fireEvent.click(row('Sem PDF').getByTitle('Editar Metadados'));

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

    expect(screen.getByText('Mostrando 1-2 de 3 artigos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Próxima/ }));
    expect(screen.getByText('Mostrando 3-3 de 3 artigos')).toBeInTheDocument();
    expect(within(mainList()).getAllByRole('row').filter((r) => r.textContent?.includes('Artigo'))).toHaveLength(1);
  });
});
