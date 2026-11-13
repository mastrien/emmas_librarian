import { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DialogProvider, informToneFromTitle, useDialogs, type Dialogs } from '../DialogProvider';

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

describe('informToneFromTitle', () => {
  it('reads a title that starts with "Erro" or "Falha" as a problem and anything else as news', () => {
    expect(informToneFromTitle('Erro ao salvar')).toBe('danger');
    expect(informToneFromTitle('  Falha na cópia')).toBe('danger');
    expect(informToneFromTitle('Não foi possível abrir o PDF')).toBe('danger');
    expect(informToneFromTitle('Backup criado')).toBe('info');
  });
});

describe('DialogProvider notice tones (board 181)', () => {
  const toneOfNotice = async (options: { title: string; tone?: 'ok' | 'warn' }) => {
    const dialogs = renderProvider();
    act(() => {
      void dialogs.current.inform({ message: 'Texto.', ...options });
    });
    const dialog = await screen.findByRole('dialog', { name: options.title });
    return dialog.querySelector('.app-modal-icon');
  };

  it('draws the icon in the tone the caller chose', async () => {
    expect(await toneOfNotice({ title: 'PDFs importados', tone: 'ok' })).toHaveClass('is-ok');
  });

  it('draws an error notice in red without the caller asking', async () => {
    expect(await toneOfNotice({ title: 'Erro ao importar' })).toHaveClass('is-danger');
  });
});

describe('DialogProvider technical details (board 181)', () => {
  const openWithDetails = async () => {
    const dialogs = renderProvider();
    act(() => {
      void dialogs.current.inform({
        title: 'Não conseguimos abrir o PDF',
        message: 'O arquivo não abriu.',
        details: "ENOENT: no such file or directory, open 'a.pdf'",
      });
    });
    return screen.findByRole('dialog', { name: 'Não conseguimos abrir o PDF' });
  };

  it('keeps the technical text folded under "Detalhes técnicos", away from the plain sentence', async () => {
    const dialog = await openWithDetails();

    expect(within(dialog).getByText('Detalhes técnicos')).toBeInTheDocument();
    expect(dialog.querySelector('details')).not.toHaveAttribute('open');
    expect(dialog.querySelector('pre')).toHaveTextContent("ENOENT: no such file or directory, open 'a.pdf'");
  });

  it('copies the details to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const dialog = await openWithDetails();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar detalhes' }));

    expect(writeText).toHaveBeenCalledWith("ENOENT: no such file or directory, open 'a.pdf'");
    expect(await within(dialog).findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('shows no details block when the notice has none', async () => {
    const dialogs = renderProvider();
    act(() => {
      void dialogs.current.inform({ title: 'Backup criado', message: 'Pronto.' });
    });

    const dialog = await screen.findByRole('dialog', { name: 'Backup criado' });

    expect(dialog.querySelector('details')).toBeNull();
  });
});

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

  it('marks a destructive question with a red icon and a notice with a neutral one (board 181)', async () => {
    const dialogs = renderProvider();

    act(() => {
      void dialogs.current.confirm(DELETE);
    });
    expect(await screen.findByRole('dialog')).toContainElement(document.querySelector('.app-modal-icon.is-danger'));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    act(() => {
      void dialogs.current.inform({ title: 'PDFs importados', message: 'Pronto.' });
    });
    await screen.findByRole('dialog', { name: 'PDFs importados' });
    expect(document.querySelector('.app-modal-icon.is-info')).not.toBeNull();
  });
});
