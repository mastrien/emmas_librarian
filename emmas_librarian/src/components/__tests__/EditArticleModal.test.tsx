import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EditArticleModal } from '../modals/EditArticleModal';
import { GlobalErrorProvider, useGlobalError } from '../../contexts/GlobalErrorContext';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { FrontendAppError } from '../../utils/AppError';
import type { Article } from '../../types';

const article = {
  id: 1,
  project_id: 1,
  title: 'Original',
  authors: '',
  year: undefined,
  doi: '',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  abstract: '',
  local_file_path: '/pdfs/a.pdf',
} as unknown as Article;

const FIELDS = ['Título *', 'Autores', 'Ano', 'DOI', 'Revista / Periódico', 'Volume', 'Edição (Issue)', 'Páginas', 'Resumo'];

let service: FakeProjectService;

function GlobalErrorProbe(): React.ReactNode {
  const { currentError } = useGlobalError();
  return currentError ? <output>{currentError.message}</output> : null;
}

function renderModal(overrides: Partial<React.ComponentProps<typeof EditArticleModal>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <ServicesProvider apiService={service}>
      <GlobalErrorProvider>
        <EditArticleModal isOpen={true} onClose={onClose} article={article} onSubmit={onSubmit} {...overrides} />
        <GlobalErrorProbe />
      </GlobalErrorProvider>
    </ServicesProvider>,
  );
  return { onClose, onSubmit: (overrides.onSubmit ?? onSubmit) as ReturnType<typeof vi.fn> };
}

const input = (label: string) => screen.getByText(label).parentElement!.querySelector('input, textarea') as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
const submit = () => fireEvent.submit(screen.getByRole('button', { name: /Salvar Alterações/ }).closest('form')!);
const aiButton = () => screen.getByRole('button', { name: /Preencher com IA/ });

beforeEach(() => {
  service = FakeProjectService.create();
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('EditArticleModal visibility', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByText('Editar Metadados do Artigo')).not.toBeInTheDocument();
  });

  it('closes from the X and Cancelar buttons without submitting', () => {
    const { onClose, onSubmit } = renderModal();

    fireEvent.click(screen.getByText('Editar Metadados do Artigo').nextElementSibling!.lastElementChild!);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refills the form when reopened for another article', () => {
    const { rerender } = render(
      <ServicesProvider apiService={service}>
        <GlobalErrorProvider>
          <EditArticleModal isOpen={true} onClose={vi.fn()} article={article} onSubmit={vi.fn()} />
        </GlobalErrorProvider>
      </ServicesProvider>,
    );
    type('Título *', 'unsaved');

    rerender(
      <ServicesProvider apiService={service}>
        <GlobalErrorProvider>
          <EditArticleModal isOpen={true} onClose={vi.fn()} article={{ ...article, id: 2, title: 'Second', year: 1999 } as Article} onSubmit={vi.fn()} />
        </GlobalErrorProvider>
      </ServicesProvider>,
    );

    expect(input('Título *')).toHaveValue('Second');
    expect(input('Ano')).toHaveValue(1999);
  });
});

describe('EditArticleModal submit', () => {
  it('trims values, parses the year, drops empty optionals and closes', async () => {
    const { onSubmit, onClose } = renderModal();
    type('Título *', '  Novo  ');
    type('Autores', ' Ana ');
    type('Ano', '2021');
    type('Volume', ' 4 ');
    type('Resumo', '   ');

    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Novo',
      authors: 'Ana',
      year: 2021,
      doi: undefined,
      journal: undefined,
      volume: '4',
      issue: undefined,
      pages: undefined,
      abstract: undefined,
    });
  });

  it('requires a non-blank title', () => {
    const { onSubmit } = renderModal();
    type('Título *', '   ');

    submit();

    expect(window.alert).toHaveBeenCalledWith('O título é obrigatório.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks the buttons while saving', async () => {
    let finish: () => void = () => undefined;
    const { onClose } = renderModal({ onSubmit: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))) });

    submit();

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Salvar Alterações/ })).toBeDisabled();
    await act(async () => finish());
    expect(onClose).toHaveBeenCalled();
  });

  const circular: Record<string, unknown> = {};
  circular.self = circular;

  it.each([
    ['an Error', new Error('disk full'), 'disk full'],
    ['a string', 'quota', 'quota'],
    ['an object with an error field', { error: 'bad doi' }, 'bad doi'],
    ['a plain object', { code: 7 }, '{"code":7}'],
    ['a circular object', circular, '[object Object]'],
    ['a number', 42, '42'],
    ['null', null, 'Erro desconhecido'],
  ])('reports a failure given as %s and stays open', async (_label, failure, message) => {
    const { onClose } = renderModal({ onSubmit: vi.fn().mockRejectedValue(failure) });

    submit();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(`Erro ao editar artigo: ${message}`));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });
});

describe('EditArticleModal AI fill', () => {
  it('is only offered when the article has a PDF', () => {
    renderModal({ article: { ...article, local_file_path: undefined } as Article });

    expect(screen.queryByRole('button', { name: /Preencher com IA/ })).not.toBeInTheDocument();
  });

  it('fills only the fields that are still empty', async () => {
    service.extractMetadata.mockResolvedValue({
      title: 'AI title',
      authors: 'AI Author',
      year: '2018',
      doi: '10.1/ai',
      journal: 'AI Journal',
      volume: '1',
      issue: '2',
      pages: '3-4',
      abstract: 'AI abstract',
    });
    renderModal();

    fireEvent.click(aiButton());

    await waitFor(() => expect(input('Autores')).toHaveValue('AI Author'));
    expect(service.extractMetadata).toHaveBeenCalledWith(1);
    expect(FIELDS.map((l) => input(l).value)).toEqual([
      'Original',
      'AI Author',
      '2018',
      '10.1/ai',
      'AI Journal',
      '1',
      '2',
      '3-4',
      'AI abstract',
    ]);
  });

  it.each([
    ['no data', null],
    ['data without values', {}],
  ])('leaves the form untouched when extraction returns %s', async (_label, data) => {
    // The service type promises an object, but the modal defends against null responses.
    service.extractMetadata.mockResolvedValue(data as never);
    renderModal();

    fireEvent.click(aiButton());

    await waitFor(() => expect(aiButton()).toBeEnabled());
    expect(FIELDS.map((l) => input(l).value)).toEqual(['Original', '', '', '', '', '', '', '', '']);
  });

  it('disables the button while extracting', async () => {
    let finish: (value: object) => void = () => undefined;
    service.extractMetadata.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    renderModal();

    fireEvent.click(aiButton());

    expect(aiButton()).toBeDisabled();
    await act(async () => finish({}));
    expect(aiButton()).toBeEnabled();
  });

  it('routes typed user-facing errors to the global error modal', async () => {
    service.extractMetadata.mockRejectedValue(new FrontendAppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Configure a chave'));
    renderModal();

    fireEvent.click(aiButton());

    expect(await screen.findByRole('status')).toHaveTextContent('Configure a chave');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it.each([
    ['an internal AppError', new FrontendAppError('ERR_INTERNAL', 'SYSTEM_ERROR', 'crash'), 'crash'],
    ['a plain Error', new Error('timeout'), 'timeout'],
    ['a string', 'offline', 'offline'],
    ['an object with an error field', { error: 'no pdf text' }, 'no pdf text'],
    ['null', null, 'Erro desconhecido'],
  ])('alerts on %s', async (_label, failure, message) => {
    service.extractMetadata.mockRejectedValue(failure);
    renderModal();

    fireEvent.click(aiButton());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(`Erro ao extrair metadados: ${message}`));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
