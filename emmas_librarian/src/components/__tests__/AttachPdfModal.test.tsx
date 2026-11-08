import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachPdfModal } from '../modals/AttachPdfModal';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';
import { FakeDialogs, withFakeDialogs } from '../common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
const renderWithDialogs = (ui: React.ReactElement) => render(ui, { wrapper: withFakeDialogs(dialogs) });

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('AttachPdfModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    dialogs = new FakeDialogs();
  });

  it('does not render when isOpen is false', () => {
    const { container } = renderWithDialogs(
      <AttachPdfModal
        isOpen={false}
        articleId={1}
        articleTitle="Test Article"
        onClose={vi.fn()}
        onAttached={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders options view by default', () => {
    renderWithDialogs(
      <AttachPdfModal isOpen={true} articleId={1} articleTitle="Test Article" onClose={vi.fn()} onAttached={vi.fn()} />,
    );

    expect(screen.getByText('Anexar PDF ao Artigo')).toBeInTheDocument();
    expect(screen.getByText('Upload do Computador')).toBeInTheDocument();
    expect(screen.getByText('Selecionar da Biblioteca')).toBeInTheDocument();
  });

  it('renders its content when opened after rendering closed', () => {
    const modal = (isOpen: boolean) => (
      <AttachPdfModal isOpen={isOpen} articleId={1} articleTitle="T" onClose={vi.fn()} onAttached={vi.fn()} />
    );
    const { rerender } = renderWithDialogs(modal(false));

    rerender(modal(true));

    expect(screen.getByText('Anexar PDF ao Artigo')).toBeInTheDocument();
  });

  it('tells an upload failure in the app window and stays open', async () => {
    fakeService.openPdfDialog.mockResolvedValue('C:/a.pdf');
    fakeService.uploadPdf.mockRejectedValue('disco cheio');
    const onClose = vi.fn();
    renderWithDialogs(<AttachPdfModal isOpen articleId={1} articleTitle="T" onClose={onClose} onAttached={vi.fn()} />);

    fireEvent.click(screen.getByText('Upload do Computador'));

    await waitFor(() =>
      expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao realizar upload do PDF: disco cheio'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
