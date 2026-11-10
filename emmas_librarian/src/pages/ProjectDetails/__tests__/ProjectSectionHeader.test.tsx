import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectSectionHeader, type ProjectSectionHeaderProps } from '../components/ProjectSectionHeader';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogs, withFakeDialogs } from '../../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import type { ProjectSection } from '../../../components/common/shell/projectNav';
import type { Article } from '../../../types';

function renderHeader(section: ProjectSection, extra: Partial<ProjectSectionHeaderProps> = {}) {
  const props: ProjectSectionHeaderProps = {
    section,
    project: { id: 3, name: 'Previsão de chuva', created_at: '2026-08-06T12:00:00Z' },
    articles: [{ id: 1, status: 'read', local_file_path: 'a.pdf' } as Article],
    historyCount: 2,
    categoryCount: 4,
    actions: {
      isEditingName: false,
      setIsEditingName: vi.fn(),
      deleteProject: vi.fn(),
    } as unknown as ProjectSectionHeaderProps['actions'],
    articleActions: { projectId: 3 } as ProjectSectionHeaderProps['articleActions'],
    onManageCategories: vi.fn(),
    onExportStrategy: vi.fn(async () => null),
    ...extra,
  };
  render(
    <ServicesProvider apiService={FakeProjectService.create()}>
      <ProjectSectionHeader {...props} />
    </ServicesProvider>,
    { wrapper: withFakeDialogs(new FakeDialogs()) },
  );
  return props;
}

const title = () => screen.getByRole('heading', { level: 1 });

describe('ProjectSectionHeader', () => {
  it('names the project on the overview, with rename and delete', () => {
    const props = renderHeader('overview');

    expect(title()).toHaveTextContent('Previsão de chuva');
    expect(screen.getByText('Criado em 06/08/2026 · 1 artigo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Renomear projeto' }));
    expect(props.actions.setIsEditingName).toHaveBeenCalledWith(true);
  });

  it('gives the articles their counts and their two actions', () => {
    renderHeader('articles');

    expect(title()).toHaveTextContent('Artigos');
    expect(screen.getByText('1 no projeto · 1 lido · 1 com PDF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar artigos/ })).toBeInTheDocument();
  });

  it('opens the categories manager from the categories header', () => {
    const props = renderHeader('categories');

    fireEvent.click(screen.getByRole('button', { name: /Gerenciar categorias/ }));

    expect(title()).toHaveTextContent('Categorias e extrações');
    expect(screen.getByText(/^4 categorias · uma coluna por categoria/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeInTheDocument();
    expect(props.onManageCategories).toHaveBeenCalled();
  });

  it('titles the diary and the search history', () => {
    renderHeader('history');
    expect(title()).toHaveTextContent('Histórico de buscas');
    expect(screen.getByText(/· 2 entradas$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar estratégia/ })).toBeInTheDocument();
  });

  it('keeps the project actions out of the other sections', () => {
    renderHeader('diary');

    expect(title()).toHaveTextContent('Diário');
    expect(screen.queryByRole('button', { name: 'Excluir projeto' })).not.toBeInTheDocument();
  });
});
