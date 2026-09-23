import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChangelogModal } from '../modals/ChangelogModal';

describe('ChangelogModal', () => {
  it('does not render when isOpen is false', () => {
    render(<ChangelogModal isOpen={false} version="2.0.0" onClose={vi.fn()} />);
    expect(screen.queryByText(/Novidades da Versão/)).toBeNull();
  });

  it('renders correctly with version and closes on button click', () => {
    const onClose = vi.fn();
    render(<ChangelogModal isOpen={true} version="2.0.0" onClose={onClose} />);

    // Check if version is rendered
    expect(screen.getByText('Novidades da Versão 2.0.0')).toBeDefined();

    // Check if new features text is present (may appear in multiple version sections)
    expect(screen.getAllByText('Categorias de Seleção Múltipla:').length).toBeGreaterThan(0);

    // Click to close
    const btn = screen.getByText('Entendido, vamos lá!');
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });

  it('lists every release from newest to oldest', () => {
    render(<ChangelogModal isOpen={true} version="1.1.23" onClose={vi.fn()} />);

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Versão 1.1.23 — Leitura de PDF & Categorias',
      'Versão 1.1.22 — Otimização Extrema de Performance',
      'Versão 1.1.21 — Estabilidade de Testes & Navegação',
      'Versão 1.1.20 — UI & UX',
      'Versão 1.1.19 — Agenda & Prazos',
      ...[18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6].map((n) => `Versão 1.1.${n}`),
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(59);
  });

  it('keeps inline formatting inside release notes', () => {
    render(<ChangelogModal isOpen={true} version="1.1.23" onClose={vi.fn()} />);

    const note = screen.getByText('Correção de Recurso Local em Produção:').closest('li') as HTMLElement;
    expect(note.querySelectorAll('code')).toHaveLength(3);
    expect(note).toHaveTextContent(
      'Correção de Recurso Local em Produção: Correção do erro Not allowed to load local resource ao abrir o aplicativo empacotado. O carregamento do index.html e do ícone agora utilizam a API app.getAppPath() para localizar corretamente os arquivos na raiz.',
    );
  });

  it('shows the API key reminder', () => {
    render(<ChangelogModal isOpen={true} version="1.1.23" onClose={vi.fn()} />);

    expect(screen.getByText('Aviso Importante')).toBeInTheDocument();
    expect(screen.getByText(/configurar suas chaves de API/)).toBeInTheDocument();
  });
});
