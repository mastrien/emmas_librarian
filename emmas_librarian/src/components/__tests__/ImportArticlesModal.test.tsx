import React from 'react';
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
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ImportArticlesModal
        isOpen={false}
        destProjectId={1}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders select project option when open', () => {
    render(
      <ImportArticlesModal
        isOpen={true}
        destProjectId={1}
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Importar Artigos de Outro Projeto')).toBeInTheDocument();
    expect(screen.getByText('-- Selecione o projeto de origem --')).toBeInTheDocument();
  });
});
