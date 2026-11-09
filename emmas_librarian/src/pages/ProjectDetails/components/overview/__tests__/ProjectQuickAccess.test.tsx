import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectQuickAccess } from '../ProjectQuickAccess';
import { ServicesProvider } from '../../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../../services/__tests__/fakes/FakeProjectService';
import type { ProjectDocument } from '../../../../../types';

function renderQuickAccess(documents: ProjectDocument[] = []) {
  const service = FakeProjectService.create();
  const onManage = vi.fn();
  render(
    <ServicesProvider apiService={service}>
      <ProjectQuickAccess documents={documents} onManage={onManage} />
    </ServicesProvider>,
  );
  return { service, onManage };
}

describe('ProjectQuickAccess', () => {
  it('opens the quick access editor from its gear', () => {
    const { onManage } = renderQuickAccess();

    fireEvent.click(screen.getByTitle('Gerenciar acessos rápidos'));

    expect(onManage).toHaveBeenCalled();
  });

  it('teaches how to add the first link', () => {
    renderQuickAccess();

    expect(
      screen.getByText('Nenhum link ou documento cadastrado. Clique na engrenagem para adicionar.'),
    ).toBeInTheDocument();
  });

  it('groups the links and opens a link or a file, recording each visit', async () => {
    const { service } = renderQuickAccess([
      { id: 1, project_id: 1, created_at: '', title: 'Google', url: 'https://google.com', category: 'General' },
      { id: 2, project_id: 1, created_at: '', title: 'Local File', local_file_path: '/local/file.pdf', category: '' },
    ]);
    expect(screen.getByText('General')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Google'));
    fireEvent.click(screen.getByText('Local File'));

    await waitFor(() => expect(service.openProjectDocumentExternal).toHaveBeenCalledTimes(2));
    expect(service.openProjectDocumentExternal).toHaveBeenCalledWith('https://google.com', undefined);
    expect(service.openProjectDocumentExternal).toHaveBeenCalledWith(undefined, '/local/file.pdf');
    // The visit orders the recent links in the project sidebar.
    expect(service.markProjectDocumentOpened).toHaveBeenCalledWith(1);
    expect(service.markProjectDocumentOpened).toHaveBeenCalledWith(2);
  });
});
