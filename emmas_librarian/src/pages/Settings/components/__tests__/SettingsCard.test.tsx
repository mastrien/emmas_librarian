import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsCard } from '../SettingsCard';

describe('SettingsCard (Arca 134)', () => {
  it('shows the title, the icon in its tone, the description and the content', () => {
    render(
      <SettingsCard title="Lixeira" icon={<svg data-testid="icone" />} iconTone="danger" description="Itens excluídos.">
        <p>conteúdo</p>
      </SettingsCard>,
    );

    expect(screen.getByRole('heading', { name: 'Lixeira', level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('icone').parentElement).toHaveClass('settings-card-icon--danger');
    expect(screen.getByText('Itens excluídos.')).toHaveClass('settings-card-description');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('keeps the tight spacing by default and the wide one when asked', () => {
    const { container, rerender } = render(<SettingsCard title="Backup">x</SettingsCard>);
    expect(container.firstChild).toHaveClass('card', 'settings-card', 'settings-card--tight');
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();

    rerender(
      <SettingsCard title="Chaves de API" spacing="wide">
        x
      </SettingsCard>,
    );
    expect(container.firstChild).toHaveClass('settings-card--wide');
  });
});
