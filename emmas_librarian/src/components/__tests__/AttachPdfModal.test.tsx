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

const renderOpen = (overrides: { onClose?: () => void; onAttached?: () => void } = {}) => {
  const props = { onClose: vi.fn(), onAttached: vi.fn(), ...overrides };
  renderWithDialogs(<AttachPdfModal isOpen articleId={1} {...props} />);
  return props;
};

const dropFile = (name: string) => {
  const file = new File(['%PDF'], name, { type: 'application/pdf' });
  fireEvent.drop(screen.getByText('Solte o PDF aqui').closest('.pdf-drop')!, { dataTransfer: { files: [file] } });
};

describe('AttachPdfModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    dialogs = new FakeDialogs();
  });

  it('does not render when isOpen is false', () => {
    const { container } = renderWithDialogs(
      <AttachPdfModal isOpen={false} articleId={1} onClose={vi.fn()} onAttached={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('offers the four ways to give the article a PDF', () => {
    renderOpen();

    expect(screen.getByRole('heading', { name: 'PDF do artigo' })).toBeInTheDocument();
    expect(screen.getByText('Solte o PDF aqui')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'escolha um arquivo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar em acesso aberto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar um PDF da biblioteca' })).toBeInTheDocument();
  });

  it('renders its content when opened after rendering closed', () => {
    const modal = (isOpen: boolean) => (
      <AttachPdfModal isOpen={isOpen} articleId={1} onClose={vi.fn()} onAttached={vi.fn()} />
    );
    const { rerender } = renderWithDialogs(modal(false));

    rerender(modal(true));

    expect(screen.getByRole('heading', { name: 'PDF do artigo' })).toBeInTheDocument();
  });

  it('attaches the file picked in the dialog and closes', async () => {
    fakeService.openPdfDialog.mockResolvedValue('C:/a.pdf');
    const { onAttached, onClose } = renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'escolha um arquivo' }));

    await waitFor(() => expect(onAttached).toHaveBeenCalled());
    expect(fakeService.uploadPdf).toHaveBeenCalledWith(1, 'C:/a.pdf');
    expect(onClose).toHaveBeenCalled();
  });

  it('attaches the PDF dropped on the area', async () => {
    const { onAttached } = renderOpen();

    dropFile('artigo.pdf');

    await waitFor(() => expect(onAttached).toHaveBeenCalled());
    expect(fakeService.uploadPdf).toHaveBeenCalledWith(1, expect.stringContaining('artigo.pdf'));
  });

  it('refuses a dropped file that is not a PDF', async () => {
    const { onAttached } = renderOpen();

    dropFile('planilha.xlsx');

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Solte um arquivo PDF.'));
    expect(fakeService.uploadPdf).not.toHaveBeenCalled();
    expect(onAttached).not.toHaveBeenCalled();
  });

  it('tells an upload failure in the app window and stays open', async () => {
    fakeService.openPdfDialog.mockResolvedValue('C:/a.pdf');
    fakeService.uploadPdf.mockRejectedValue('disco cheio');
    const { onClose } = renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'escolha um arquivo' }));

    await waitFor(() =>
      expect(dialogs.informMessage).toHaveBeenCalledWith('Erro ao realizar upload do PDF: disco cheio'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after the open access copy is downloaded', async () => {
    fakeService.fetchOpenAccessPdf.mockResolvedValue({ status: 'downloaded', source: 'arXiv' });
    const { onAttached, onClose } = renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Buscar em acesso aberto' }));

    await waitFor(() => expect(onAttached).toHaveBeenCalled());
    expect(fakeService.fetchOpenAccessPdf).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('says why there was no open access copy and stays open', async () => {
    fakeService.fetchOpenAccessPdf.mockResolvedValue({ status: 'no-doi' });
    const { onClose } = renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Buscar em acesso aberto' }));

    await waitFor(() => expect(dialogs.informMessage).toHaveBeenCalledWith('Sem DOI para procurar a cópia aberta.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('links a stored PDF chosen from the library and goes back to the options', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([{ file_path: '/lib/x.pdf', filename: 'x.pdf', file_size: 2048 }]);
    const { onAttached } = renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Usar um PDF da biblioteca' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vincular' }));

    await waitFor(() => expect(onAttached).toHaveBeenCalled());
    expect(fakeService.linkPdfToArticle).toHaveBeenCalledWith(1, '/lib/x.pdf');
  });

  it('filters the library by file name and can go back', async () => {
    fakeService.getStoredPdfs.mockResolvedValue([
      { file_path: '/lib/x.pdf', filename: 'x.pdf', file_size: 10 },
      { file_path: '/lib/y.pdf', filename: 'y.pdf', file_size: 10 },
    ]);
    renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Usar um PDF da biblioteca' }));
    await screen.findByText('y.pdf');
    fireEvent.change(screen.getByLabelText('Pesquisar PDFs armazenados'), { target: { value: 'x.' } });

    expect(screen.queryByText('y.pdf')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Voltar para as opções/ }));
    expect(screen.getByText('Solte o PDF aqui')).toBeInTheDocument();
  });
});
