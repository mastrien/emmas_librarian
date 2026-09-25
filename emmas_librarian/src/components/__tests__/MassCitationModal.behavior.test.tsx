import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MassCitationModal } from '../modals/MassCitationModal';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../types';

vi.mock('../../services/citationService', async (importActual) => {
  const actual = await importActual<typeof import('../../services/citationService')>();
  return {
    ...actual,
    generateCitation: (a: { title: string }, style: string, format: string) =>
      format === 'html' ? `<b>${a.title}</b> ${style}` : `${a.title} ${style} ${format}`,
  };
});

class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}

const clipboard = { write: vi.fn(), writeText: vi.fn() };
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const article = (id: number, overrides: Partial<Article> = {}): Article =>
  ({
    id,
    project_id: 1,
    title: `T${id}`,
    authors: `Autor${id}`,
    year: 2000 + id,
    status: 'read',
    ...overrides,
  }) as Article;

let service: FakeProjectService;

function renderModal(articles: Article[], extra: { onClose?: () => void; onArticlesUpdated?: () => void } = {}) {
  const onClose = extra.onClose ?? vi.fn();
  render(
    <ServicesProvider apiService={service}>
      <MassCitationModal
        isOpen={true}
        onClose={onClose}
        articles={articles}
        onArticlesUpdated={extra.onArticlesUpdated}
      />
    </ServicesProvider>,
  );
  return { onClose };
}

const field = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;

beforeEach(() => {
  service = FakeProjectService.create();
  clipboard.write.mockReset().mockResolvedValue(undefined);
  clipboard.writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MassCitationModal list', () => {
  it('shows an empty state and disables copying without articles', () => {
    renderModal([]);

    expect(screen.getByText('Nenhum artigo marcado como lido neste projeto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar Todas/ })).toBeDisabled();
  });

  it('numbers the citations', () => {
    renderModal([article(1), article(2)]);

    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('[2]')).toBeInTheDocument();
  });

  it('orders articles without a year first chronologically', () => {
    renderModal([article(1, { year: 2020 }), article(2, { year: undefined })]);

    fireEvent.change(screen.getByDisplayValue('Ordem Alfabética (Autor)'), { target: { value: 'year' } });

    const titles = Array.from(document.querySelectorAll('b')).map((b) => b.textContent);
    expect(titles).toEqual(['T2', 'T1']);
  });

  it('closes from the footer, the X button and the backdrop but not from the card', () => {
    const { onClose } = renderModal([article(1)]);

    fireEvent.click(screen.getByText('Citação em Massa (Artigos Lidos)'));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByText('Citação em Massa (Artigos Lidos)').nextElementSibling as HTMLElement);
    fireEvent.click(document.body.lastElementChild as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('MassCitationModal copy', () => {
  it('copies all citations as rich HTML with a plain-text alternative', async () => {
    renderModal([article(1), article(2)]);

    fireEvent.click(screen.getByRole('button', { name: /Copiar Todas/ }));

    await screen.findByRole('button', { name: /Copiado!/ });
    const [item] = clipboard.write.mock.calls[0][0] as FakeClipboardItem[];
    expect(await readBlob(item.items['text/html'])).toBe('<b>T1</b> abnt<br/><br/><b>T2</b> abnt');
    expect(await readBlob(item.items['text/plain'])).toBe('T1 abnt\n\nT2 abnt');
  });

  it('falls back to plain text when rich copy fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    clipboard.write.mockRejectedValue(new Error('denied'));
    renderModal([article(1)]);

    fireEvent.click(screen.getByRole('button', { name: /Copiar Todas/ }));

    await screen.findByRole('button', { name: /Copiado!/ });
    expect(clipboard.writeText).toHaveBeenCalledWith('T1 abnt');
  });

  it('joins non-HTML formats with blank lines and resets the label after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderModal([article(1), article(2)]);
    fireEvent.click(screen.getByRole('button', { name: /Texto/ }));

    fireEvent.click(screen.getByRole('button', { name: /Copiar Todas/ }));

    await screen.findByRole('button', { name: /Copiado!/ });
    expect(clipboard.writeText).toHaveBeenCalledWith('T1 abnt text\n\nT2 abnt text');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('button', { name: /Copiar Todas/ })).toBeInTheDocument();
  });
});

describe('MassCitationModal editing', () => {
  const openEditor = () => fireEvent.click(screen.getByTitle('Editar metadados para esta referência'));

  it('cancels editing without saving', () => {
    renderModal([article(1)]);
    openEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Editar Metadados da Citação')).not.toBeInTheDocument();
    expect(service.updateArticleMetadata).not.toHaveBeenCalled();
  });

  it('alerts and stays in the editor when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.updateArticleMetadata.mockRejectedValue(new Error('locked'));
    const onArticlesUpdated = vi.fn();
    renderModal([article(1)], { onArticlesUpdated });
    openEditor();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao salvar metadados.'));
    expect(onArticlesUpdated).not.toHaveBeenCalled();
    expect(screen.getByText('Editar Metadados da Citação')).toBeInTheDocument();
  });

  it('saves without a year when it is cleared', async () => {
    renderModal([article(1)]);
    openEditor();
    fireEvent.change(field('year'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/ }));

    await waitFor(() => expect(service.updateArticleMetadata).toHaveBeenCalled());
    expect(service.updateArticleMetadata.mock.calls[0][1]).toMatchObject({ year: undefined });
  });

  it('resets to the values the modal was opened with when there is no csl_json', () => {
    renderModal([article(1, { title: 'Original' })]);
    openEditor();
    fireEvent.change(field('title'), { target: { value: 'Editado' } });

    fireEvent.click(screen.getByRole('button', { name: /Resetar/ }));

    expect(field('title')).toHaveValue('Original');
  });

  it('falls back to the opening values when csl_json is invalid', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderModal([article(1, { title: 'Original', csl_json: '{bad' })]);
    openEditor();
    fireEvent.change(field('title'), { target: { value: 'Editado' } });

    fireEvent.click(screen.getByRole('button', { name: /Resetar/ }));

    expect(field('title')).toHaveValue('Original');
    expect(consoleError).toHaveBeenCalledWith('Failed to parse csl_json for reset', expect.any(Error));
  });

  it('reads pages from the standard CSL "page" field on reset', () => {
    renderModal([article(1, { csl_json: JSON.stringify({ title: 'CSL', page: '9-12' }) })]);
    openEditor();

    fireEvent.click(screen.getByRole('button', { name: /Resetar/ }));

    expect(field('pages')).toHaveValue('9-12');
  });
});
