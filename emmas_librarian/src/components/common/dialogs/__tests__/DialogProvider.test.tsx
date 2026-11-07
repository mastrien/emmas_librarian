import { useEffect } from 'react';
import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DialogProvider, useDialogs, type Dialogs } from '../DialogProvider';

// Hands the test the dialogs of the provider it is rendered in.
const Grab: React.FC<{ onReady: (dialogs: Dialogs) => void }> = ({ onReady }) => {
  const dialogs = useDialogs();
  useEffect(() => {
    onReady(dialogs);
  }, [dialogs, onReady]);
  return null;
};

function renderProvider() {
  const handle = {} as { current: Dialogs };
  render(
    <DialogProvider>
      <Grab onReady={(dialogs) => (handle.current = dialogs)} />
    </DialogProvider>,
  );
  return handle;
}

const DELETE = {
  title: 'Excluir evento',
  message: 'Os prazos também saem.',
  confirmLabel: 'Excluir evento',
  danger: true,
};

describe('DialogProvider (Arca 103/134)', () => {
  it('asks with the app window and resolves true on the confirm button', async () => {
    const dialogs = renderProvider();
    let answer: Promise<boolean> = Promise.resolve(false);

    act(() => {
      answer = dialogs.current.confirm(DELETE);
    });
    const dialog = await screen.findByRole('dialog', { name: 'Excluir evento' });
    expect(dialog).toHaveTextContent('Os prazos também saem.');
    expect(within(dialog).getByRole('button', { name: 'Excluir evento' })).toHaveClass('btn-danger');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir evento' }));

    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['Cancelar', (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))],
    ['the X', (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))],
    ['Esc', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('resolves false when closed with %s', async (_way, close) => {
    const dialogs = renderProvider();
    let answer: Promise<boolean> = Promise.resolve(true);

    act(() => {
      answer = dialogs.current.confirm(DELETE);
    });
    close(await screen.findByRole('dialog'));

    await expect(answer).resolves.toBe(false);
  });

  it('shows a message with one button and resolves when it closes', async () => {
    const dialogs = renderProvider();
    let closed = false;

    act(() => {
      void dialogs.current.inform({ title: 'Backup criado', message: 'Salvo em C:\\backup.emmabak' }).then(() => {
        closed = true;
      });
    });
    const dialog = await screen.findByRole('dialog', { name: 'Backup criado' });
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['', 'Entendi']);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Entendi' }));
    });

    expect(closed).toBe(true);
  });

  it('shows requests one at a time, in the order they came', async () => {
    const dialogs = renderProvider();
    const answers: Promise<boolean>[] = [];

    act(() => {
      answers.push(dialogs.current.confirm({ ...DELETE, title: 'Primeiro' }));
      answers.push(dialogs.current.confirm({ ...DELETE, title: 'Segundo' }));
    });
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Primeiro' })).getByRole('button', { name: 'Cancelar' }));
    const second = await screen.findByRole('dialog', { name: 'Segundo' });
    fireEvent.click(within(second).getByRole('button', { name: 'Excluir evento' }));

    await expect(Promise.all(answers)).resolves.toEqual([false, true]);
  });

  it('names the missing provider instead of failing silently', () => {
    const Orphan = () => {
      useDialogs();
      return null;
    };

    expect(() => render(<Orphan />)).toThrow('useDialogs() precisa de um <DialogProvider>');
  });
});
