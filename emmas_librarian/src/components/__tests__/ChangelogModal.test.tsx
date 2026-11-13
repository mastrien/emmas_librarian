import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChangelogModal } from '../modals/ChangelogModal';

describe('ChangelogModal', () => {
  it('does not render when isOpen is false', () => {
    render(<ChangelogModal isOpen={false} version="2.0.0" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly with version and closes on button click', () => {
    const onClose = vi.fn();
    render(<ChangelogModal isOpen={true} version="2.0.0" onClose={onClose} />);

    // Check if version is rendered
    expect(screen.getByRole('dialog', { name: 'Novidades da Versão 2.0.0' })).toBeDefined();

    // Click to close
    const btn = screen.getByRole('button', { name: 'Continuar' });
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the version as the title, under a small "Novidades" label (board 181)', () => {
    render(<ChangelogModal isOpen={true} version="1.3.1" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Versão 1.3.1' })).toBeInTheDocument();
    expect(screen.getByText('Novidades')).toBeInTheDocument();
  });

  it('shows only the current release until "Ver todas as versões" is clicked', () => {
    render(<ChangelogModal isOpen={true} version="1.3.1" onClose={vi.fn()} />);

    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getAllByRole('listitem').length).toBeLessThan(10);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as versões' }));

    expect(screen.queryByRole('button', { name: 'Ver todas as versões' })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Versão 1.3.1 — Correções pequenas');
    expect(screen.getAllByRole('listitem')).toHaveLength(82);
  });

  it('keeps inline formatting inside release notes', () => {
    render(<ChangelogModal isOpen={true} version="1.1.23" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as versões' }));

    const note = screen.getByText('Correção de Recurso Local em Produção:').closest('li') as HTMLElement;
    expect(note.querySelectorAll('code')).toHaveLength(3);
    expect(note).toHaveTextContent(
      'Correção de Recurso Local em Produção: Correção do erro Not allowed to load local resource ao abrir o aplicativo empacotado. O carregamento do index.html e do ícone agora utilizam a API app.getAppPath() para localizar corretamente os arquivos na raiz.',
    );
  });
});
