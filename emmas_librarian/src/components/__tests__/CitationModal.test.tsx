import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CitationModal } from '../modals/CitationModal';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../types';

// Deterministic stand-in for citation-js so assertions target the modal, not CSL formatting.
vi.mock('../../services/citationService', () => ({
  generateCitation: (article: { title: string; pages?: string }, style: string, format: string, etAl: boolean) =>
    format === 'html'
      ? `<i>${article.title}</i> [${style}|${etAl ? 'etal' : 'full'}|p${article.pages ?? ''}]`
      : `${article.title} [${style}|${format}|${etAl ? 'etal' : 'full'}]`,
}));

class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}

const clipboard = { write: vi.fn(), writeText: vi.fn() };

const baseArticle = {
  id: 7,
  project_id: 1,
  title: 'Deep Nets',
  authors: 'Ana Lima',
  year: 2020,
  doi: '10.1/x',
  journal: 'J',
  volume: '3',
  issue: '2',
  pages: '10-20',
  url: 'http://x',
  accessed: '2026-01-01',
} as unknown as Article;

let service: FakeProjectService;

function renderModal(props: Partial<React.ComponentProps<typeof CitationModal>> = {}) {
  const onClose = vi.fn();
  const onArticleUpdated = vi.fn();
  const utils = render(
    <ServicesProvider apiService={service}>
      <CitationModal
        isOpen={true}
        onClose={onClose}
        article={baseArticle}
        onArticleUpdated={onArticleUpdated}
        {...props}
      />
    </ServicesProvider>,
  );
  return { ...utils, onClose, onArticleUpdated };
}

// jsdom's Blob has no .text(); FileReader is the portable way to read it back.
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const field = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const preview = () => screen.getByRole('button', { name: /Copiar|Copiado!/ }).previousElementSibling as HTMLElement;

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

describe('CitationModal visibility', () => {
  it.each([
    ['closed', { isOpen: false }],
    ['without an article', { article: null }],
  ])('renders nothing when %s', (_label, props) => {
    renderModal(props);

    expect(screen.queryByText('Gerar Citação')).not.toBeInTheDocument();
  });

  it('closes from the X button and the backdrop, but not from inside the card', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByText('Gerar Citação'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Gerar Citação').nextElementSibling as HTMLElement);
    fireEvent.click(document.body.lastElementChild as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('CitationModal citation preview', () => {
  it('starts with ABNT, rich HTML and et al.', () => {
    renderModal();

    expect(screen.getByRole('combobox')).toHaveValue('abnt');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(preview().querySelector('i')).toHaveTextContent('Deep Nets');
    expect(preview()).toHaveTextContent('Deep Nets [abnt|etal|p10-20]');
  });

  it('regenerates when style, et al. or format change', () => {
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ieee' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(preview()).toHaveTextContent('Deep Nets [ieee|full|p10-20]');

    fireEvent.click(screen.getByRole('button', { name: /Texto Simples/ }));
    expect(preview()).toHaveTextContent('Deep Nets [ieee|text|full]');
    expect(preview().querySelector('i')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /BibTeX/ }));
    expect(preview()).toHaveTextContent('Deep Nets [ieee|bibtex|full]');
    expect(screen.getByRole('button', { name: /BibTeX/ })).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: /Visualização/ })).toHaveClass('btn-secondary');
  });

  it('reflects metadata edits in the preview', () => {
    renderModal();

    fireEvent.change(field('title'), { target: { value: 'Shallow Nets' } });

    expect(preview()).toHaveTextContent('Shallow Nets [abnt|etal|p10-20]');
  });

  it('resets style-independent state when opened for another article', () => {
    const { rerender } = renderModal();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Metadados do Artigo/ }));

    rerender(
      <ServicesProvider apiService={service}>
        <CitationModal isOpen={true} onClose={vi.fn()} article={{ ...baseArticle, id: 8, title: 'Other' } as Article} />
      </ServicesProvider>,
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(field('title')).toHaveValue('Other');
    expect(field('title').closest('div[style*="max-height"]')).toHaveStyle({ maxHeight: '0' });
  });
});

describe('CitationModal metadata accordion', () => {
  it('toggles open and closed', () => {
    renderModal();
    const panel = () => field('title').closest('div[style*="max-height"]') as HTMLElement;
    expect(panel()).toHaveStyle({ maxHeight: '0', opacity: '0' });

    fireEvent.click(screen.getByRole('button', { name: /Metadados do Artigo/ }));
    expect(panel()).toHaveStyle({ maxHeight: '1000px', opacity: '1' });

    fireEvent.click(screen.getByRole('button', { name: /Metadados do Artigo/ }));
    expect(panel()).toHaveStyle({ maxHeight: '0' });
  });

  it('prefills every field from the article', () => {
    renderModal();

    expect(
      ['title', 'authors', 'year', 'doi', 'journal', 'volume', 'issue', 'pages', 'url', 'accessed'].map(
        (n) => field(n)?.value,
      ),
    ).toEqual(['Deep Nets', 'Ana Lima', '2020', '10.1/x', 'J', '3', '2', '10-20', 'http://x', '2026-01-01']);
  });

  it('lets the user edit the pages field', () => {
    renderModal();

    fireEvent.change(field('pages'), { target: { value: '33-40' } });

    expect(field('pages')).toHaveValue('33-40');
    expect(preview()).toHaveTextContent('p33-40');
  });
});

describe('CitationModal saving', () => {
  it('persists edited metadata, parsing the year', async () => {
    const { onArticleUpdated } = renderModal();
    fireEvent.change(field('year'), { target: { value: '2021' } });
    fireEvent.change(field('pages'), { target: { value: '1-2' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Metadados/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Metadados salvos com sucesso!'));
    expect(service.updateArticleMetadata).toHaveBeenCalledWith(7, {
      title: 'Deep Nets',
      authors: 'Ana Lima',
      year: 2021,
      doi: '10.1/x',
      journal: 'J',
      volume: '3',
      issue: '2',
      pages: '1-2',
      url: 'http://x',
      accessed: '2026-01-01',
    });
    expect(onArticleUpdated).toHaveBeenCalledTimes(1);
  });

  it('sends no year when it was cleared and works without an update callback', async () => {
    renderModal({ onArticleUpdated: undefined });
    fireEvent.change(field('year'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Metadados/ }));

    await waitFor(() => expect(service.updateArticleMetadata).toHaveBeenCalled());
    expect(service.updateArticleMetadata.mock.calls[0][1]).toMatchObject({ year: undefined });
  });

  it('shows progress while saving', async () => {
    let finish: () => void = () => undefined;
    service.updateArticleMetadata.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Metadados/ }));

    expect(await screen.findByRole('button', { name: /Salvando/ })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: /Salvar Metadados/ })).toBeEnabled();
  });

  it('reports a failed save', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.updateArticleMetadata.mockRejectedValue(new Error('locked'));
    const { onArticleUpdated } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Metadados/ }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao salvar metadados.'));
    expect(consoleError).toHaveBeenCalledWith('Erro ao salvar metadados:', expect.any(Error));
    expect(onArticleUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Salvar Metadados/ })).toBeEnabled();
  });
});

describe('CitationModal reset', () => {
  const csl = {
    title: 'CSL Title',
    author: [{ given: 'Ana', family: 'Lima' }, { literal: 'OMS' }, { family: 'Souza' }, { given: 'Rui' }, {}],
    issued: { 'date-parts': [[2019, 5]] },
    DOI: '10.9/csl',
    'container-title': 'CSL Journal',
    volume: '9',
    issue: '1',
    page: '5-6',
    URL: 'http://csl',
  };

  const resetButton = () => screen.getByRole('button', { name: /Resetar/ });

  it.each([
    ['a JSON string', JSON.stringify(csl)],
    ['an object', csl],
  ])('restores metadata from csl_json stored as %s', (_label, cslJson) => {
    renderModal({ article: { ...baseArticle, csl_json: cslJson } as unknown as Article });
    fireEvent.change(field('title'), { target: { value: 'edited' } });

    fireEvent.click(resetButton());

    expect(
      ['title', 'authors', 'year', 'doi', 'journal', 'volume', 'issue', 'pages', 'url', 'accessed'].map(
        (n) => field(n).value,
      ),
    ).toEqual([
      'CSL Title',
      'Ana Lima; OMS; Souza; Rui',
      '2019',
      '10.9/csl',
      'CSL Journal',
      '9',
      '1',
      '5-6',
      'http://csl',
      '',
    ]);
  });

  it('leaves missing CSL fields empty', () => {
    renderModal({ article: { ...baseArticle, csl_json: '{}' } as unknown as Article });

    fireEvent.click(resetButton());

    expect(['title', 'authors', 'year', 'pages'].map((n) => field(n).value)).toEqual(['', '', '', '']);
  });

  it('falls back to the saved values when csl_json is invalid', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderModal({ article: { ...baseArticle, csl_json: '{broken' } as unknown as Article });
    fireEvent.change(field('title'), { target: { value: 'edited' } });
    fireEvent.change(field('pages'), { target: { value: '99' } });

    fireEvent.click(resetButton());

    expect(consoleError).toHaveBeenCalledWith('Failed to parse csl_json for reset', expect.any(Error));
    expect(field('title')).toHaveValue('Deep Nets');
    expect(field('pages')).toHaveValue('10-20');
  });

  it('falls back to the saved values when there is no csl_json', () => {
    renderModal({ article: { ...baseArticle, csl_json: null, year: undefined } as unknown as Article });
    fireEvent.change(field('title'), { target: { value: 'edited' } });

    fireEvent.click(resetButton());

    expect(field('title')).toHaveValue('Deep Nets');
    expect(field('year')).toHaveValue(null);
  });
});

describe('CitationModal copy', () => {
  it('copies rich HTML plus a tag-free plain text fallback', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));

    await screen.findByRole('button', { name: /Copiado!/ });
    const [item] = clipboard.write.mock.calls[0][0] as FakeClipboardItem[];
    expect(await readBlob(item.items['text/html'])).toBe('<i>Deep Nets</i> [abnt|etal|p10-20]');
    expect(await readBlob(item.items['text/plain'])).toBe('Deep Nets [abnt|etal|p10-20]');
  });

  it('falls back to plain text when rich copy is rejected', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    clipboard.write.mockRejectedValue(new Error('denied'));
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));

    await screen.findByRole('button', { name: /Copiado!/ });
    expect(clipboard.writeText).toHaveBeenCalledWith('Deep Nets [abnt|etal|p10-20]');
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to copy rich text, falling back to plain text:',
      expect.any(Error),
    );
  });

  it('copies non-HTML formats verbatim and resets the label after 2 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /BibTeX/ }));

    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));

    await screen.findByRole('button', { name: /Copiado!/ });
    expect(clipboard.writeText).toHaveBeenCalledWith('Deep Nets [abnt|bibtex|etal]');
    expect(clipboard.write).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('button', { name: /Copiar/ })).toBeInTheDocument();
  });
});
