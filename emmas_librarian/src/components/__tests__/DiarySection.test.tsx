import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { DiarySection } from '../common/DiarySection';
import { ServicesProvider } from '../../contexts/ServicesContext';
import { DialogProvider } from '../common/dialogs/DialogProvider';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import type { DiaryEntry } from '../../types';
import { localIsoDate } from '../../utils/localDate';

vi.mock('@mdxeditor/editor', async () => (await import('./fakes/FakeMdxEditor')).fakeMdxEditorModule);
vi.mock('@mdxeditor/editor/style.css', () => ({}));

const PROJECT_ID = 1;
// The diary names pages after the local day (see localIsoDate), not the UTC one.
const TODAY = localIsoDate();
const PAST = '2026-03-05';
const OTHER = '2026-03-04';

let service: FakeProjectService;

const entry = (entry_date: string, content = ''): DiaryEntry => ({
  id: 0,
  project_id: PROJECT_ID,
  entry_date,
  content,
});

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// The page list names a day "05/03", and today "Hoje" (board 155).
function shortDate(iso: string): string {
  if (iso === TODAY) return 'Hoje';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function givenEntries(...entries: DiaryEntry[]): void {
  service.getDiaryEntries.mockResolvedValue(entries);
  service.getDiaryEntry.mockImplementation(async (_p, date) => entries.find((e) => e.entry_date === date) ?? null);
}

function renderDiary() {
  return render(
    <ServicesProvider apiService={service}>
      <DialogProvider>
        <DiarySection projectId={PROJECT_ID} />
      </DialogProvider>
    </ServicesProvider>,
  );
}

async function openEntry(iso: string, expectedContent: string): Promise<HTMLTextAreaElement> {
  fireEvent.click(await screen.findByText(shortDate(iso)));
  await screen.findByRole('heading', { name: longDate(iso) });
  const editor = screen.getByLabelText<HTMLTextAreaElement>('editor');
  await waitFor(() => expect(editor.value).toBe(expectedContent));
  return editor;
}

const typeInto = (editor: HTMLElement, text: string) => fireEvent.change(editor, { target: { value: text } });
const deleteButton = () => screen.getByRole('button', { name: 'Excluir página' });

beforeEach(() => {
  service = FakeProjectService.create();
  // Ler/Editar is remembered between visits.
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DiarySection timeline', () => {
  it('shows empty states when there are no entries', async () => {
    renderDiary();

    expect(await screen.findByText('Nenhuma página ainda.')).toBeInTheDocument();
    expect(screen.getByText('Diário do projeto')).toBeInTheDocument();
    expect(service.getDiaryEntries).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('lists the pages by their first line, today as "Hoje"', async () => {
    givenEntries(entry(TODAY, '## Critérios'), entry(PAST, 'Busca #2 salva'));
    renderDiary();

    const todayButton = (await screen.findByText('Critérios')).closest('button') as HTMLElement;
    expect(within(todayButton).getByText('Hoje')).toBeInTheDocument();
    const pastButton = screen.getByText(shortDate(PAST)).closest('button') as HTMLElement;
    expect(within(pastButton).getByText('Busca #2 salva')).toBeInTheDocument();
    expect(screen.queryByText('Criar a página de hoje')).not.toBeInTheDocument();
  });

  // Decision on the redesign canvas (board 155): today without a page shows the way to start it.
  it("offers to create today's page when it is missing", async () => {
    givenEntries(entry(PAST));
    renderDiary();

    expect(await screen.findByRole('button', { name: /Criar a página de hoje/ })).toBeInTheDocument();
  });

  it('opens an entry and loads its content into the editor', async () => {
    givenEntries(entry(PAST, '# notas'));
    renderDiary();

    await openEntry(PAST, '# notas');

    expect(service.getDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, PAST);
  });
});

describe('DiarySection today page', () => {
  it("creates today's page when missing, then opens it", async () => {
    givenEntries(entry(PAST));
    renderDiary();
    await screen.findByText(shortDate(PAST));

    fireEvent.click(screen.getByRole('button', { name: 'Página de hoje' }));

    await screen.findByRole('heading', { name: longDate(TODAY) });
    expect(service.saveDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, TODAY, '', null);
    expect(service.getDiaryEntries).toHaveBeenCalledTimes(2);
  });

  it("opens today's page without recreating it", async () => {
    givenEntries(entry(TODAY, 'ok'));
    renderDiary();
    await screen.findByText(shortDate(TODAY));

    fireEvent.click(screen.getByRole('button', { name: 'Página de hoje' }));

    await screen.findByRole('heading', { name: longDate(TODAY) });
    expect(service.saveDiaryEntry).not.toHaveBeenCalled();
  });
});

describe('DiarySection saving', () => {
  it('marks unsaved changes; the page saves by itself, with no save button', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    typeInto(editor, 'ab');

    expect(screen.getByText('Não salvo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salvar/ })).not.toBeInTheDocument();
  });

  it('auto-saves after 2 seconds of inactivity', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');
    // Pure fake timers (no shouldAdvanceTime): wall-clock time under load must not reach the 2s boundary.
    vi.useFakeTimers();

    typeInto(editor, 'abc');
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(service.saveDiaryEntry).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(service.saveDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, PAST, 'abc', 'a');
    vi.useRealTimers();
    expect(await screen.findByText(/^Salvo às \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('does not auto-save whitespace-only content', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    typeInto(editor, '   ');
    await act(() => vi.advanceTimersByTimeAsync(2500));

    expect(service.saveDiaryEntry).not.toHaveBeenCalled();
  });

  it('saves pending changes before switching dates and cancels the pending auto-save', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, 'a'), entry(OTHER, 'b'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    typeInto(editor, 'a2');
    await openEntry(OTHER, 'b');
    await act(() => vi.advanceTimersByTimeAsync(2500));

    expect(service.saveDiaryEntry.mock.calls).toEqual([[PROJECT_ID, PAST, 'a2', 'a']]);
  });
});

describe('DiarySection view mode', () => {
  it('toggles between Ler and Editar', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    fireEvent.click(screen.getByRole('button', { name: /Ler/ }));

    expect(screen.getByLabelText('editor')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(editor).not.toHaveAttribute('readonly');
  });

  // Decision on the redesign canvas (board 155): the mode stays from page to page and from one visit to the next.
  it('keeps Ler on other pages and on the next visit', async () => {
    givenEntries(entry(PAST, 'a'), entry(OTHER, 'b'));
    const first = renderDiary();
    await openEntry(PAST, 'a');
    fireEvent.click(screen.getByRole('button', { name: /Ler/ }));

    await openEntry(OTHER, 'b');
    expect(screen.getByLabelText('editor')).toHaveAttribute('readonly');

    first.unmount();
    renderDiary();
    await openEntry(PAST, 'a');
    expect(screen.getByRole('button', { name: /Ler/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DiarySection deletion', () => {
  it('deletes the page after confirmation', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    await openEntry(PAST, 'a');

    fireEvent.click(deleteButton());
    // The app's own question (Arca 134), with the page's date.
    expect(await screen.findByRole('dialog', { name: 'Excluir página?' })).toHaveTextContent(longDate(PAST));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await screen.findByText('Diário do projeto');
    expect(service.deleteDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, PAST);
    expect(screen.queryByText('Excluir página?')).not.toBeInTheDocument();
  });

  it('keeps the page when deletion is cancelled', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    await openEntry(PAST, 'a');

    fireEvent.click(deleteButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByText('Excluir página?')).not.toBeInTheDocument());
    expect(service.deleteDiaryEntry).not.toHaveBeenCalled();
  });
});

describe('DiarySection history', () => {
  const version = (id: number, content: string, updated_at = '2026-03-05 10:00:00') => ({ id, content, updated_at });
  const openHistory = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    return screen.findByRole('dialog', { name: 'Histórico de Versões' });
  };

  it('lists the current page and the versions with what differs from it (board 180)', async () => {
    givenEntries(entry(PAST, '# Critérios\nlinha nova\nlinha igual'));
    service.getDiaryEntryHistory.mockResolvedValue([
      version(11, '# Critérios\nlinha velha\nlinha igual'),
      version(10, '# Critérios'),
    ]);
    renderDiary();
    await openEntry(PAST, '# Critérios\nlinha nova\nlinha igual');

    const dialog = await openHistory();

    expect(service.getDiaryEntryHistory).toHaveBeenCalledWith(PROJECT_ID, PAST);
    expect(within(dialog).getByRole('heading', { name: 'Versões de “Critérios”' })).toBeInTheDocument();
    const list = within(dialog).getByRole('group', { name: 'Versões' });
    expect(within(list).getByText('a página como está')).toBeInTheDocument();
    expect(within(list).getByText('−1 linha, +1 linha')).toBeInTheDocument();
    expect(within(list).getByText('primeira versão')).toBeInTheDocument();
  });

  it('shows the chosen version with what came in after it in green and what went out in red', async () => {
    givenEntries(entry(PAST, 'um dois novo'));
    service.getDiaryEntryHistory.mockResolvedValue([version(10, 'um dois velho')]);
    renderDiary();
    await openEntry(PAST, 'um dois novo');

    const dialog = await openHistory();

    expect(dialog.querySelector('.diary-history__text ins')).toHaveTextContent('novo');
    expect(dialog.querySelector('.diary-history__text del')).toHaveTextContent('velho');
  });

  it('chooses another version from the list', async () => {
    givenEntries(entry(PAST, 'atual'));
    service.getDiaryEntryHistory.mockResolvedValue([version(11, 'segunda'), version(10, 'primeira')]);
    renderDiary();
    await openEntry(PAST, 'atual');
    const dialog = await openHistory();
    expect(within(dialog).getAllByRole('button', { pressed: true })).toHaveLength(1);

    fireEvent.click(within(dialog).getByText('primeira versão').closest('button')!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar esta versão' }));

    await waitFor(() => expect(service.restoreDiaryEntryVersion).toHaveBeenCalledWith(10));
  });

  it('shows an empty history and closes it', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    await openEntry(PAST, 'a');

    const dialog = await openHistory();
    expect(within(dialog).getByText('Nenhuma versão anterior encontrada.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Restaurar esta versão' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog', { name: 'Histórico de Versões' })).not.toBeInTheDocument();
  });

  it('cannot restore the current page, which is not a version', async () => {
    givenEntries(entry(PAST, 'a'));
    service.getDiaryEntryHistory.mockResolvedValue([version(10, 'antes')]);
    renderDiary();
    await openEntry(PAST, 'a');
    const dialog = await openHistory();

    fireEvent.click(within(dialog).getByText('Atual').closest('button')!);

    expect(within(dialog).getByRole('button', { name: 'Restaurar esta versão' })).toBeDisabled();
  });

  it('restores a version into the editor', async () => {
    givenEntries(entry(PAST, 'old'));
    service.getDiaryEntryHistory.mockResolvedValue([version(10, 'restored')]);
    renderDiary();
    await openEntry(PAST, 'old');
    await openHistory();
    service.getDiaryEntry.mockResolvedValue(entry(PAST, 'restored'));

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar esta versão' }));

    // The restored page is read again into a new editor.
    await waitFor(() => expect(screen.getByLabelText<HTMLTextAreaElement>('editor').value).toBe('restored'));
    expect(service.restoreDiaryEntryVersion).toHaveBeenCalledWith(10);
    expect(screen.queryByRole('dialog', { name: 'Histórico de Versões' })).not.toBeInTheDocument();
  });

  it('logs and stays open when history fails to load or restore', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    givenEntries(entry(PAST, 'a'));
    service.getDiaryEntryHistory.mockRejectedValueOnce(new Error('db down'));
    renderDiary();
    await openEntry(PAST, 'a');

    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to load diary history:', expect.any(Error)));
    expect(screen.queryByRole('dialog', { name: 'Histórico de Versões' })).not.toBeInTheDocument();

    service.getDiaryEntryHistory.mockResolvedValue([version(10, 'v')]);
    service.restoreDiaryEntryVersion.mockRejectedValueOnce(new Error('locked'));
    await openHistory();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar esta versão' }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to restore diary version:', expect.any(Error)),
    );
    expect(screen.getByRole('dialog', { name: 'Histórico de Versões' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});

// The page that overwrote another: opening A then B quickly, A's text arrived after B's and an editor event then saved
// it under B. Each page is its own instance now, so there is nowhere for it to land.
describe('DiarySection never mixes the text of two pages', () => {
  const deferred = <T,>() => {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };

  it('shows page B and saves only B under B, even when A answers last', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, 'texto de A'), entry(OTHER, 'texto de B'));
    const slowA = deferred<DiaryEntry>();
    service.getDiaryEntry.mockImplementation((_p, date) =>
      date === PAST ? slowA.promise : Promise.resolve(entry(OTHER, 'texto de B')),
    );
    renderDiary();
    fireEvent.click(await screen.findByText(shortDate(PAST)));
    fireEvent.click(await screen.findByText(shortDate(OTHER)));
    const editor = await screen.findByLabelText<HTMLTextAreaElement>('editor');
    await waitFor(() => expect(editor.value).toBe('texto de B'));

    await act(async () => slowA.resolve(entry(PAST, 'texto de A')));
    await act(() => vi.advanceTimersByTimeAsync(100));
    // The late answer of A must not reach the page of B.
    expect(screen.getByLabelText<HTMLTextAreaElement>('editor').value).toBe('texto de B');
    typeInto(screen.getByLabelText('editor'), 'texto de B, editado');
    await act(() => vi.advanceTimersByTimeAsync(2500));

    expect(screen.getByLabelText<HTMLTextAreaElement>('editor').value).toBe('texto de B, editado');
    expect(service.saveDiaryEntry.mock.calls).toEqual([[PROJECT_ID, OTHER, 'texto de B, editado', 'texto de B']]);
  });

  it('does not save a page just because the editor rewrote it while loading', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, '* item um\n* item dois'));
    renderDiary();
    await openEntry(PAST, '- item um\n- item dois');

    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(service.saveDiaryEntry).not.toHaveBeenCalled();
    expect(screen.queryByText('Não salvo')).not.toBeInTheDocument();
  });

  it('does not save when the text is put back as it was', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    typeInto(editor, 'ab');
    typeInto(editor, 'a');
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(service.saveDiaryEntry).not.toHaveBeenCalled();
    expect(screen.queryByText('Não salvo')).not.toBeInTheDocument();
  });

  it('keeps the text of a page that was left before it was saved, under that same page', async () => {
    givenEntries(entry(PAST, 'a'), entry(OTHER, 'b'));
    renderDiary();
    typeInto(await openEntry(PAST, 'a'), 'a editado');

    await openEntry(OTHER, 'b');

    await waitFor(() => expect(service.saveDiaryEntry.mock.calls).toEqual([[PROJECT_ID, PAST, 'a editado', 'a']]));
  });

  it('says so and writes nothing more when the page changed somewhere else, and reads it again on request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, 'a'));
    service.saveDiaryEntry.mockRejectedValue(Object.assign(new Error('alterada'), { code: 'ERR_DIARY_CONFLICT' }));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    typeInto(editor, 'a1');
    await act(() => vi.advanceTimersByTimeAsync(2500));
    expect(await screen.findByRole('alert')).toHaveTextContent('a página mudou em outro lugar');
    typeInto(editor, 'a12');
    await act(() => vi.advanceTimersByTimeAsync(2500));

    expect(service.saveDiaryEntry).toHaveBeenCalledTimes(1);
    service.getDiaryEntry.mockResolvedValue(entry(PAST, 'texto que está no banco'));
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLTextAreaElement>('editor').value).toBe('texto que está no banco'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says a save failed, and tries again with the next change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    givenEntries(entry(PAST, 'a'));
    service.saveDiaryEntry.mockRejectedValueOnce(new Error('disco cheio'));
    renderDiary();
    const editor = await openEntry(PAST, 'a');

    typeInto(editor, 'a1');
    await act(() => vi.advanceTimersByTimeAsync(2500));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    typeInto(editor, 'a12');
    await act(() => vi.advanceTimersByTimeAsync(2500));

    expect(service.saveDiaryEntry).toHaveBeenLastCalledWith(PROJECT_ID, PAST, 'a12', 'a');
    consoleError.mockRestore();
  });

  it('does not bring a deleted page back by saving what was waiting', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    typeInto(await openEntry(PAST, 'a'), 'a editado');

    fireEvent.click(deleteButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await screen.findByText('Diário do projeto');
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(service.deleteDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, PAST);
    expect(service.saveDiaryEntry).not.toHaveBeenCalled();
  });

  it('saves what is waiting before it reads the versions, so they include it', async () => {
    givenEntries(entry(PAST, 'a'));
    const order: string[] = [];
    service.saveDiaryEntry.mockImplementation(async () => void order.push('save'));
    service.getDiaryEntryHistory.mockImplementation(async () => {
      order.push('history');
      return [];
    });
    renderDiary();
    typeInto(await openEntry(PAST, 'a'), 'a editado');

    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    await screen.findByRole('dialog', { name: 'Histórico de Versões' });

    expect(order).toEqual(['save', 'history']);
  });
});
