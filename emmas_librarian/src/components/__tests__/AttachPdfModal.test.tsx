import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachPdfModal } from '../modals/AttachPdfModal';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('AttachPdfModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AttachPdfModal
        isOpen={false}
        articleId={1}
        articleTitle="Test Article"
        onClose={vi.fn()}
        onAttached={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders options view by default', () => {
    render(
      <AttachPdfModal
        isOpen={true}
        articleId={1}
        articleTitle="Test Article"
        onClose={vi.fn()}
        onAttached={vi.fn()}
      />
    );

    expect(screen.getByText('Anexar PDF ao Artigo')).toBeInTheDocument();
    expect(screen.getByText('Upload do Computador')).toBeInTheDocument();
    expect(screen.getByText('Selecionar da Biblioteca')).toBeInTheDocument();
  });
});
