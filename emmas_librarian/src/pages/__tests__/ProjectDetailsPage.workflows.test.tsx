import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within, createEvent } from '@testing-library/react';
import { givenProject, renderProjectPage, article, mainTable } from './support/projectPageHarness';
import type { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { AIModelConfig } from '../../types';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

const openAddMenu = () => fireEvent.click(screen.getByRole('button', { name: /Adicionar Artigos/ }));
const container = () => screen.getByTestId('project-details-container');
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' });

function dropFiles(files: File[]): void {
  const drop = createEvent.drop(container());
  Object.defineProperty(drop, 'dataTransfer', { value: { files, types: ['Files'] } });
  fireEvent(container(), drop);
}

function dragOverWith(types: string[]): void {
  const over = createEvent.dragOver(container());
  Object.defineProperty(over, 'dataTransfer', { value: { types } });
  fireEvent(container(), over);
}

describe('ProjectDetailsPage batch PDF import', () => {
  it('imports the selected PDFs, reports the count and reloads', async () => {
    const service = givenProject();
    service.openMultiplePdfsDialog.mockResolvedValue(['/in/a.pdf', '/in/b.pdf']);
    service.createArticlesFromPdfs.mockResolvedValue(2);
    await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Importar PDFs em Lote/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('2 artigo(s) importado(s) com sucesso.'));
    expect(service.createArticlesFromPdfs).toHaveBeenCalledWith(1, ['/in/a.pdf', '/in/b.pdf']);
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['cancelled', null],
    ['empty', []],
  ])('does nothing when the dialog is %s', async (_label, selection) => {
    const service = givenProject();
    service.openMultiplePdfsDialog.mockResolvedValue(selection as never);
    await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Importar PDFs em Lote/ }));

    await waitFor(() => expect(service.openMultiplePdfsDialog).toHaveBeenCalled());
    expect(service.createArticlesFromPdfs).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('alerts when the import fails', async () => {
    const service = givenProject();
    service.openMultiplePdfsDialog.mockResolvedValue(['/in/a.pdf']);
    service.createArticlesFromPdfs.mockRejectedValue(new Error('disk full'));
    await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Importar PDFs em Lote/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao importar PDFs: disk full'));
  });
});

describe('ProjectDetailsPage drag and drop', () => {
  it('shows the drop overlay only for file drags', async () => {
    await renderProjectPage(givenProject());

    dragOverWith(['text/plain']);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();

    dragOverWith(['Files']);
    expect(screen.getByText('Solte seus PDFs aqui para importar')).toBeInTheDocument();
  });

  it('keeps the overlay while dragging over children and hides it when leaving the page', async () => {
    await renderProjectPage(givenProject());
    const child = container().appendChild(document.createElement('div'));
    const leaveTowards = (relatedTarget: Node | null) => {
      const leave = createEvent.dragLeave(container());
      Object.defineProperty(leave, 'relatedTarget', { value: relatedTarget });
      fireEvent(container(), leave);
    };
    dragOverWith(['Files']);

    leaveTowards(child);
    expect(screen.getByText('Solte seus PDFs aqui para importar')).toBeInTheDocument();

    leaveTowards(document.body);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();

    dragOverWith([]);
    leaveTowards(null);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();
  });

  it('imports dropped PDFs by their filesystem path and ignores other files', async () => {
    vi.spyOn(window.electronAPI, 'getPathForFile').mockImplementation((file) => `/dropped/${file.name}`);
    const service = givenProject();
    service.createArticlesFromPdfs.mockResolvedValue(1);
    await renderProjectPage(service);
    dragOverWith(['Files']);

    dropFiles([pdf('paper.PDF'), new File(['x'], 'notes.txt')]);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('1 artigo(s) importado(s) com sucesso.'));
    expect(service.createArticlesFromPdfs).toHaveBeenCalledWith(1, ['/dropped/paper.PDF']);
    expect(screen.queryByText('Solte seus PDFs aqui para importar')).not.toBeInTheDocument();
  });

  it('falls back to the file name when the bridge cannot resolve paths', async () => {
    const bridge = window.electronAPI;
    window.electronAPI = { ...bridge, getPathForFile: undefined as unknown as typeof bridge.getPathForFile };
    const service = givenProject();
    service.createArticlesFromPdfs.mockResolvedValue(1);
    await renderProjectPage(service);

    dropFiles([pdf('a.pdf')]);

    await waitFor(() => expect(service.createArticlesFromPdfs).toHaveBeenCalledWith(1, ['a.pdf']));
    window.electronAPI = bridge;
  });

  it('ignores drops without PDFs', async () => {
    const service = givenProject();
    await renderProjectPage(service);

    dropFiles([new File(['x'], 'notes.txt')]);

    expect(service.createArticlesFromPdfs).not.toHaveBeenCalled();
  });

  it('alerts when a dropped import fails', async () => {
    const service = givenProject();
    service.createArticlesFromPdfs.mockRejectedValue('offline');
    await renderProjectPage(service);

    dropFiles([pdf('a.pdf')]);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao importar PDFs: offline'));
  });
});

describe('ProjectDetailsPage article forms', () => {
  it('creates a manual article and reloads', async () => {
    const service = givenProject();
    await renderProjectPage(service);

    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: /Artigo Manual/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex: A New Approach to Bibliometrics'), { target: { value: 'Manual' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Artigo/ }));

    await waitFor(() => expect(service.createManualArticle).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Manual' }), undefined));
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('edits a manual article and reloads', async () => {
    const service = givenProject([article({ id: 8, title: 'Avulso', source_databases: '["Manual"]' })]);
    await renderProjectPage(service);

    fireEvent.click(within(mainTable()).getByTitle('Editar Metadados'));
    fireEvent.change(screen.getByDisplayValue('Avulso'), { target: { value: 'Avulso revisado' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() => expect(service.updateArticleMetadata).toHaveBeenCalledWith(8, expect.objectContaining({ title: 'Avulso revisado' })));
    await waitFor(() => expect(service.getArticles).toHaveBeenCalledTimes(2));
  });

  it('treats a legacy bare source value as a single source instead of crashing the page', async () => {
    await renderProjectPage(givenProject([article({ id: 8, title: 'Legado', source_databases: 'Manual' })]));

    expect(within(mainTable()).getByText('⚠️ Manual')).toBeInTheDocument();
    expect(within(mainTable()).getByTitle('Editar Metadados')).toBeInTheDocument();
  });

  it('only offers editing for manual articles', async () => {
    await renderProjectPage(givenProject([article({ id: 8, title: 'Importado', source_databases: '["Scopus"]' })]));

    expect(within(mainTable()).queryByTitle('Editar Metadados')).not.toBeInTheDocument();
  });
});

describe('ProjectDetailsPage massive investigation', () => {
  const withPdfs = [
    article({ id: 1, title: 'Artigo Um', local_file_path: '/a.pdf' }),
    article({ id: 2, title: 'Artigo Dois', local_file_path: '/b.pdf' }),
  ];
  const extractionConfig = (provider: string, model_name: string) =>
    [{ skill: 'extraction', provider, model_name }] as unknown as AIModelConfig[];

  /** Runs an investigation and waits until the page leaves the extracting state (its last update). */
  async function runInvestigation(service: FakeProjectService, question = 'Q1?'): Promise<void> {
    await renderProjectPage(service);
    fireEvent.click(screen.getByTitle('Extração Inteligente IA'));
    fireEvent.change(await screen.findByPlaceholderText('Pergunta 1'), { target: { value: question } });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Investigação/ }));
    await waitFor(() => expect(service.massiveExtraction).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTitle('Fechar')).toBeEnabled());
  }

  it('saves the investigation, every answer, and refreshes the history', async () => {
    const service = givenProject(withPdfs);
    service.getAiModelConfigs.mockResolvedValue(extractionConfig('gemini', 'gemini-2.5-pro'));
    service.saveMassiveInvestigation.mockResolvedValue(40);
    service.massiveExtraction.mockResolvedValue([{ question: 'Q1?', answer: 'sim' }] as never);

    await runInvestigation(service, '  Q1?  ');

    await waitFor(() => expect(service.getMassiveInvestigations).toHaveBeenCalledTimes(2));
    expect(service.massiveExtraction.mock.calls).toEqual([
      [1, ['  Q1?  ']],
      [2, ['  Q1?  ']],
    ]);
    expect(service.saveMassiveInvestigation).toHaveBeenCalledWith(1, ['  Q1?  '], [1, 2], 'Gemini (gemini-2.5-pro)', 'Sucesso');
    const success = { question: 'Q1?', answer: '{"question":"Q1?","answer":"sim"}', quote: null, status: 'success', error_message: null };
    expect(service.saveInvestigationResults.mock.calls).toEqual([
      [40, 1, [success]],
      [40, 2, [success]],
    ]);
  });

  it('records a failed article and keeps going on non-quota errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = givenProject(withPdfs);
    service.saveMassiveInvestigation.mockResolvedValue(41);
    service.massiveExtraction.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce([{ question: 'Q1?' }] as never);

    await runInvestigation(service);

    await waitFor(() => expect(service.saveInvestigationResults).toHaveBeenCalledTimes(2));
    expect(service.saveInvestigationResults.mock.calls[0]).toEqual([
      41,
      1,
      [{ question: 'Q1?', answer: null, quote: null, status: 'error', error_message: 'timeout' }],
    ]);
    expect(service.saveInvestigationResults.mock.calls[1][2][0].status).toBe('success');
    expect(service.saveMassiveInvestigation.mock.calls[0][4]).toBe('Sucesso');
    expect(consoleError).toHaveBeenCalledWith('Erro ao extrair de Artigo Um:', expect.any(Error));
  });

  it('stops on a quota error, shows the quota modal and records the rest as skipped', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = givenProject(withPdfs);
    service.saveMassiveInvestigation.mockResolvedValue(42);
    service.massiveExtraction.mockRejectedValue(new Error('HTTP 429 Too Many Requests'));

    await runInvestigation(service);

    await waitFor(() => expect(service.saveInvestigationResults).toHaveBeenCalledTimes(2));
    expect(service.massiveExtraction).toHaveBeenCalledTimes(1);
    expect(service.saveMassiveInvestigation.mock.calls[0][4]).toBe('Erro: Quota Excedida');
    expect(service.saveInvestigationResults.mock.calls[1]).toEqual([
      42,
      2,
      [{ question: 'Q1?', answer: null, quote: null, status: 'skipped', error_message: 'Cancelado ou não executado.' }],
    ]);
    expect(await screen.findByRole('heading', { name: 'Limite de Cota Atingido' })).toBeInTheDocument();
  });

  it.each([
    ['no extraction config', [], 'Desconhecido'],
    ['a provider without a display name', extractionConfig('ollama_cloud', 'llama3'), 'ollama_cloud (llama3)'],
    ['no model name', extractionConfig('openai', ''), 'OpenAI'],
  ])('describes the model when there is %s', async (_label, configs, description) => {
    const service = givenProject(withPdfs);
    service.getAiModelConfigs.mockResolvedValue(configs as AIModelConfig[]);
    service.massiveExtraction.mockResolvedValue([] as never);

    await runInvestigation(service);

    await waitFor(() => expect(service.saveMassiveInvestigation).toHaveBeenCalled());
    expect(service.saveMassiveInvestigation.mock.calls[0][3]).toBe(description);
  });

  it('describes the model as unknown when configs cannot be loaded', async () => {
    const service = givenProject(withPdfs);
    service.getAiModelConfigs.mockRejectedValue(new Error('db'));
    service.massiveExtraction.mockResolvedValue([] as never);

    await runInvestigation(service);

    await waitFor(() => expect(service.saveMassiveInvestigation).toHaveBeenCalled());
    expect(service.saveMassiveInvestigation.mock.calls[0][3]).toBe('Desconhecido');
  });

  it('reports a failure to persist the investigation through the global error modal', async () => {
    const service = givenProject(withPdfs);
    service.massiveExtraction.mockResolvedValue([] as never);
    service.saveMassiveInvestigation.mockRejectedValue(new Error('database is locked'));

    await runInvestigation(service);

    expect(await screen.findByTestId('global-error')).toHaveTextContent('database is locked');
  });
});
