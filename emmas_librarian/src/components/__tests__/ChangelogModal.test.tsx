import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChangelogModal } from '../ChangelogModal';

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
    
    // Check if new features text is present
    expect(screen.getByText('Gráficos e Estatísticas:')).toBeDefined();

    // Click to close
    const btn = screen.getByText('Entendido, vamos lá!');
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });
});
