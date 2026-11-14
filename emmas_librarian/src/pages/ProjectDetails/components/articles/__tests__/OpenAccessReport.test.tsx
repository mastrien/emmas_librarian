import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenAccessReport, reportTotals } from '../OpenAccessReport';
import type { ReportEntry } from '../openAccessText';

const entries: ReportEntry[] = [
  { articleId: 1, title: 'Baixado', outcome: { status: 'downloaded', source: 'arXiv' } },
  { articleId: 2, title: 'Fechado', outcome: { status: 'not-open' } },
  { articleId: 3, title: 'Sem DOI', outcome: { status: 'no-doi' } },
  { articleId: 4, title: 'Falhou', outcome: { status: 'failed', error: 'HTTP 503' } },
  { articleId: 5, title: 'Bloqueado', outcome: { status: 'blocked', landingPages: ['https://exemplo.org'] } },
  { articleId: 6, title: 'Já tinha', outcome: { status: 'already' } },
];

describe('OpenAccessReport (board 178)', () => {
  it('counts downloaded, without an open version and failed (a blocked copy counts as failed)', () => {
    expect(reportTotals(entries)).toEqual({ downloaded: 1, noOpenVersion: 2, failed: 2 });
  });

  it('shows the three numbers under a plain title and says how many articles were looked up', () => {
    render(<OpenAccessReport report={{ entries, total: 6 }} onClose={vi.fn()} />);

    const dialog = within(screen.getByRole('dialog', { name: /PDFs abertos: 1 de 6 baixados/ }));
    expect(dialog.getByRole('heading', { name: 'PDFs em acesso aberto' })).toBeInTheDocument();
    expect(dialog.getByText('6 artigos sem PDF procurados')).toBeInTheDocument();
    const summary = within(dialog.getByRole('group', { name: 'Resumo' }));
    expect(summary.getByText('Baixados').nextElementSibling).toHaveTextContent('1');
    expect(summary.getByText('Sem versão aberta').nextElementSibling).toHaveTextContent('2');
    expect(summary.getByText('Falharam').nextElementSibling).toHaveTextContent('2');
  });

  it('closes with "Concluir"', () => {
    const onClose = vi.fn();
    render(<OpenAccessReport report={{ entries, total: 6 }} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
