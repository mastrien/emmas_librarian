import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';
import { PageCommandsProvider, useRegisteredCommands, usePageCommands } from '../PageCommandsContext';
import { ServicesProvider } from '../../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../../services/__tests__/fakes/FakeProjectService';

const Screen: React.FC<{ run: () => void; label?: string }> = ({ run, label = 'Novo evento' }) => {
  usePageCommands('agenda', [{ id: 'agenda:new', label, run }]);
  return null;
};

const Listed = () => (
  <ul>
    {useRegisteredCommands().map((c) => (
      <li key={c.id}>{`${c.group}: ${c.label}`}</li>
    ))}
  </ul>
);

const Buttons = () => (
  <>
    {useRegisteredCommands().map((c) => (
      <button key={c.id} onClick={c.run}>
        {c.label}
      </button>
    ))}
  </>
);

describe('usePageCommands', () => {
  it('lists the commands of a mounted screen under "Nesta tela" and drops them when it goes away', () => {
    const { rerender } = render(
      <PageCommandsProvider>
        <Screen run={vi.fn()} />
        <Listed />
      </PageCommandsProvider>,
    );
    expect(screen.getByText('Nesta tela: Novo evento')).toBeInTheDocument();

    rerender(
      <PageCommandsProvider>
        <Listed />
      </PageCommandsProvider>,
    );
    expect(screen.queryByText('Nesta tela: Novo evento')).not.toBeInTheDocument();
  });

  it('runs the latest callback of the screen, not the one from the render that registered it', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <PageCommandsProvider>
        <Screen run={first} />
        <Buttons />
      </PageCommandsProvider>,
    );

    rerender(
      <PageCommandsProvider>
        <Screen run={latest} />
        <Buttons />
      </PageCommandsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Novo evento' }));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('does nothing without a provider (a screen rendered on its own)', () => {
    expect(() => render(<Screen run={vi.fn()} />)).not.toThrow();
  });
});

describe('CommandPalette with a screen command', () => {
  it('lists the screen command first and runs it instead of navigating', async () => {
    const run = vi.fn();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <ServicesProvider apiService={FakeProjectService.create()}>
          <PageCommandsProvider>
            <Screen run={run} />
            <CommandPalette onClose={onClose} />
          </PageCommandsProvider>
        </ServicesProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('option', { name: 'Novo evento' }));

    expect(run).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });
});
