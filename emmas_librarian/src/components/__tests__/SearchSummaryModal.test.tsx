import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchSummaryModal } from '../modals/SearchSummaryModal';
import type { SearchPreview } from '../../types';

const preview: SearchPreview = {
  previewId: 'preview-1',
  breakdown: {
    openalex: { count: 3 },
    wos: { count: 2 },
    crossref: { count: 0, error: 'API Timeout' },
  },
  results: [
    {
      title: 'Aprendizado de máquina na revisão',
      authors: 'Ana Lima',
      year: 2024,
      doi: '10.1/a',
      sourceDatabases: ['OpenAlex', 'Web of Science'],
      alreadyInProject: false,
      details: { abstract: 'Um estudo sobre revisão sistemática.', journal: 'Revista de Computação' },
    },
    { title: 'Artigo antigo', sourceDatabases: ['OpenAlex'], alreadyInProject: true, details: {} },
  ],
};

const renderModal = (overrides: Partial<React.ComponentProps<typeof SearchSummaryModal>> = {}) => {
  const props = { preview, isSaving: false, onSave: vi.fn(), onDiscard: vi.fn(), ...overrides };
  render(<SearchSummaryModal {...props} />);
  return props;
};

describe('SearchSummaryModal', () => {
  const stat = (label: string) =>
    within(screen.getByRole('group', { name: 'Contagem da busca' })).getByText(label).parentElement!;

  // #52: a search run again shows what is new, and what the project already has stays one click away.
  describe('showing only what is new', () => {
    const toggle = () => screen.getByRole('checkbox', { name: /Mostrar só o que não está no projeto \(1 já está\)/ });
    const list = () => within(screen.getByRole('list', { name: 'Artigos encontrados' }));

    it('starts with everything in a plain search', () => {
      renderModal();

      expect(toggle()).not.toBeChecked();
      expect(list().getByText('Artigo antigo')).toBeInTheDocument();
    });

    it('starts without what the project has when a search runs again, and can show it', () => {
      renderModal({ startOnlyNew: true });

      expect(toggle()).toBeChecked();
      expect(list().queryByText('Artigo antigo')).not.toBeInTheDocument();
      expect(list().getByText('Aprendizado de máquina na revisão')).toBeInTheDocument();

      fireEvent.click(toggle());
      expect(list().getByText('Artigo antigo')).toBeInTheDocument();
    });

    it('offers no choice when nothing is in the project yet', () => {
      renderModal({ preview: { ...preview, results: [preview.results[0]] } });

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('still counts everything, whatever the list shows', () => {
      renderModal({ startOnlyNew: true });

      expect(stat('Já no projeto')).toHaveTextContent('1');
    });
  });

  it('breaks the total down so that found - repeated - already in project = new', () => {
    renderModal();

    expect(screen.getByText(/Nada foi salvo ainda/)).toBeInTheDocument();
    expect(within(stat('Encontrados')).getByText('5')).toBeInTheDocument();
    expect(within(stat('Repetidos')).getByText('3')).toBeInTheDocument();
    expect(within(stat('Já no projeto')).getByText('1')).toBeInTheDocument();
    expect(within(stat('Novos')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/Novos são os que entram no projeto ao salvar/)).toBeInTheDocument();
  });

  it('shows the per-database outcome, including failures', () => {
    renderModal();

    const byBase = within(screen.getByRole('region', { name: 'Resultados por base' }));
    expect(byBase.getByText('OpenAlex')).toBeInTheDocument();
    expect(byBase.getByText('Web of Science')).toBeInTheDocument();
    expect(byBase.getByText('Crossref')).toBeInTheDocument();
    expect(byBase.getByText('Falha')).toBeInTheDocument();
    expect(byBase.getByText('API Timeout')).toBeInTheDocument();
  });

  // A base that stopped mid-search keeps what arrived; the reason shows on its line (option V1 of the mock-up).
  it('explains on its line why a base stopped early and how many the base had', () => {
    const warning =
      'Web of Science: a busca parou em 150 de 500 resultados (Erro 429). Os resultados recebidos foram mantidos.';
    renderModal({
      preview: {
        ...preview,
        breakdown: {
          openalex: { count: 1000, requested: 1000, available: 5321, requests: 10 },
          wos: { count: 150, requested: 500, available: 900, requests: 4, warning },
        },
      },
    });

    const byBase = within(screen.getByRole('region', { name: 'Resultados por base' }));
    expect(byBase.getByText('1.000 de 5.321 na base')).toBeInTheDocument();
    expect(byBase.getByText('150 de 900 na base')).toBeInTheDocument();
    expect(byBase.getByText(warning)).toBeInTheDocument();
  });

  it.each([
    [[false], 'Salvar 1 novo no projeto'],
    [[false, false], 'Salvar 2 novos no projeto'],
    [[true], 'Salvar no projeto (nenhum artigo novo)'],
  ])('says how many articles saving will add (%j already in project)', (flags, label) => {
    const results = flags.map((alreadyInProject, i) => ({
      title: `Artigo ${i}`,
      sourceDatabases: ['OpenAlex'],
      alreadyInProject,
      details: {},
    }));

    renderModal({ preview: { ...preview, results } });

    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('lists every result with its authors, year and sources, flagging the ones already in the project', () => {
    renderModal();

    const items = within(screen.getByRole('list', { name: 'Artigos encontrados' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Aprendizado de máquina na revisão');
    expect(items[0]).toHaveTextContent('Ana Lima · 2024 · OpenAlex, Web of Science');
    expect(within(items[0]).queryByText('Já no projeto')).not.toBeInTheDocument();
    expect(within(items[1]).getByText('Já no projeto')).toBeInTheDocument();
  });

  it('opens the metadata of a result from its title, without PDF or project-origin sections', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Aprendizado de máquina na revisão' }));

    expect(screen.getByText('Um estudo sobre revisão sistemática.')).toBeInTheDocument();
    expect(screen.getByText('Revista de Computação')).toBeInTheDocument();
    expect(screen.queryByText('ORIGEM NO PROJETO')).not.toBeInTheDocument();
    expect(screen.queryByText('ARQUIVO PDF')).not.toBeInTheDocument();
  });

  it('closes the metadata and keeps the review open', () => {
    const { onDiscard } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Aprendizado de máquina na revisão' }));

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByText('Um estudo sobre revisão sistemática.')).not.toBeInTheDocument();
    expect(screen.getByText('Busca Concluída!')).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('says so when the search found nothing', () => {
    renderModal({ preview: { ...preview, results: [] } });

    expect(screen.getByText('Nenhum artigo encontrado com essa busca.')).toBeInTheDocument();
  });

  it('saves with "Salvar no projeto" and discards with "Descartar" or the close button', () => {
    const { onSave, onDiscard } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Salvar .*no projeto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar e descartar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(2);
  });

  // Discarding loses results that cost API calls; Esc may also be meant for the metadata window above.
  it('keeps the results when Esc is pressed, with or without the metadata open', () => {
    const { onDiscard } = renderModal();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprendizado de máquina na revisão' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Busca Concluída' })).toBeInTheDocument();
  });

  it('shows a save error inside the dialog', () => {
    renderModal({ saveError: 'disco cheio' });

    expect(screen.getByRole('alert')).toHaveTextContent('disco cheio');
  });

  it('disables the choices while saving', () => {
    renderModal({ isSaving: true });

    expect(screen.getByRole('button', { name: /Salvar .*no projeto/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/ })).toBeDisabled();
    // The X discards too, so it waits for the save as well.
    expect(screen.getByRole('button', { name: 'Fechar e descartar' })).toBeDisabled();
  });

  it('marks each base by how it went: failed, stopped early or fine', () => {
    renderModal({
      preview: {
        ...preview,
        breakdown: {
          openalex: { count: 3 },
          wos: { count: 1, warning: 'parou cedo' },
          scopus: { count: 0, error: 'HTTP 503' },
        },
      },
    });

    const byBase = within(screen.getByRole('region', { name: 'Resultados por base' }));
    const row = (name: string) => byBase.getByText(name).closest('.search-breakdown-row');
    expect(row('OpenAlex')).toHaveClass('search-breakdown-row--ok');
    expect(row('Web of Science')).toHaveClass('search-breakdown-row--warning');
    expect(row('Scopus')).toHaveClass('search-breakdown-row--error');
  });
});
