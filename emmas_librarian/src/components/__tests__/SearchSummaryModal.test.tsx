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
    },
    { title: 'Artigo antigo', sourceDatabases: ['OpenAlex'], alreadyInProject: true },
  ],
};

const renderModal = (overrides: Partial<React.ComponentProps<typeof SearchSummaryModal>> = {}) => {
  const props = { preview, isSaving: false, onSave: vi.fn(), onDiscard: vi.fn(), ...overrides };
  render(<SearchSummaryModal {...props} />);
  return props;
};

describe('SearchSummaryModal', () => {
  it('shows totals, the per-database outcome and says nothing is saved yet', () => {
    renderModal();

    expect(screen.getByText('Busca Concluída!')).toBeInTheDocument();
    expect(screen.getByText(/Nada foi salvo ainda/)).toBeInTheDocument();
    expect(within(screen.getByText('Total Encontrado').parentElement!).getByText('5')).toBeInTheDocument();
    expect(within(screen.getByText('Sem Duplicatas').parentElement!).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByText('Já no Projeto').parentElement!).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Web of Science')).toBeInTheDocument();
    expect(screen.getByText('Falha')).toBeInTheDocument();
    expect(screen.getByText('API Timeout')).toBeInTheDocument();
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

  it('says so when the search found nothing', () => {
    renderModal({ preview: { ...preview, results: [] } });

    expect(screen.getByText('Nenhum artigo encontrado com essa busca.')).toBeInTheDocument();
  });

  it('saves with "Salvar no projeto" and discards with "Descartar" or the close button', () => {
    const { onSave, onDiscard } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Salvar no projeto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar e descartar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(2);
  });

  it('shows a save error inside the dialog', () => {
    renderModal({ saveError: 'disco cheio' });

    expect(screen.getByRole('alert')).toHaveTextContent('disco cheio');
  });

  it('disables the choices while saving', () => {
    renderModal({ isSaving: true });

    expect(screen.getByRole('button', { name: /Salvar no projeto/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/ })).toBeDisabled();
  });
});
