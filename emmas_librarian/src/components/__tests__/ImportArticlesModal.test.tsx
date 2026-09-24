import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportArticlesModal } from '../modals/ImportArticlesModal';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('ImportArticlesModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    fakeService.getProjects.mockResolvedValue([
      { id: 1, name: 'Destino', created_at: '' },
      { id: 2, name: 'Origem', created_at: '' },
    ]);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ImportArticlesModal isOpen={false} destProjectId={1} onClose={vi.fn()} onImportComplete={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('offers every other project as a source, excluding the destination', async () => {
    render(<ImportArticlesModal isOpen={true} destProjectId={1} onClose={vi.fn()} onImportComplete={vi.fn()} />);

    expect(screen.getByText('Importar Artigos de Outro Projeto')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Origem' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '-- Selecione o projeto de origem --' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Destino' })).not.toBeInTheDocument();
  });

  it('renders its content when opened after rendering closed', async () => {
    const modal = (isOpen: boolean) => (
      <ImportArticlesModal isOpen={isOpen} destProjectId={1} onClose={vi.fn()} onImportComplete={vi.fn()} />
    );
    const { rerender } = render(modal(false));

    rerender(modal(true));

    expect(screen.getByText('Importar Artigos de Outro Projeto')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Origem' })).toBeInTheDocument();
  });
});
