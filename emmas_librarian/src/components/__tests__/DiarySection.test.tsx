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
    expect(service.saveDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, TODAY, '');
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

    expect(service.saveDiaryEntry).toHaveBeenCalledWith(PROJECT_ID, PAST, 'abc');
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

    expect(service.saveDiaryEntry.mock.calls).toEqual([[PROJECT_ID, PAST, 'a2']]);
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
  const longText = 'x'.repeat(151);

  it('lists previous versions with truncated previews', async () => {
    givenEntries(entry(PAST, 'a'));
    service.getDiaryEntryHistory.mockResolvedValue([
      { id: 10, content: longText, updated_at: '2026-03-05T10:00:00Z' },
      { id: 11, content: '', updated_at: '2026-03-05T09:00:00Z' },
    ]);
    renderDiary();
    await openEntry(PAST, 'a');

    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));

    await screen.findByText('Histórico de Versões');
    expect(service.getDiaryEntryHistory).toHaveBeenCalledWith(PROJECT_ID, PAST);
    expect(screen.getByText(`${'x'.repeat(150)}...`)).toBeInTheDocument();
    expect(screen.getByText('(Vazio)')).toBeInTheDocument();
  });

  it('shows an empty history and closes it', async () => {
    givenEntries(entry(PAST, 'a'));
    renderDiary();
    await openEntry(PAST, 'a');

    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    await screen.findByText('Nenhuma versão anterior encontrada.');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByText('Histórico de Versões')).not.toBeInTheDocument();
  });

  it('restores a version into the editor', async () => {
    givenEntries(entry(PAST, 'old'));
    service.getDiaryEntryHistory.mockResolvedValue([
      { id: 10, content: 'restored', updated_at: '2026-03-05T10:00:00Z' },
    ]);
    renderDiary();
    const editor = await openEntry(PAST, 'old');
    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    await screen.findByText('Histórico de Versões');
    service.getDiaryEntry.mockResolvedValue(entry(PAST, 'restored'));

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

    await waitFor(() => expect(editor.value).toBe('restored'));
    expect(service.restoreDiaryEntryVersion).toHaveBeenCalledWith(10);
    expect(screen.queryByText('Histórico de Versões')).not.toBeInTheDocument();
  });

  it('logs and stays open when history fails to load or restore', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    givenEntries(entry(PAST, 'a'));
    service.getDiaryEntryHistory.mockRejectedValueOnce(new Error('db down'));
    renderDiary();
    await openEntry(PAST, 'a');

    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to load diary history:', expect.any(Error)));
    expect(screen.queryByText('Histórico de Versões')).not.toBeInTheDocument();

    service.getDiaryEntryHistory.mockResolvedValue([{ id: 10, content: 'v', updated_at: '2026-03-05T10:00:00Z' }]);
    service.restoreDiaryEntryVersion.mockRejectedValueOnce(new Error('locked'));
    fireEvent.click(screen.getByRole('button', { name: /Versões/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to restore diary version:', expect.any(Error)),
    );
    expect(screen.getByText('Histórico de Versões')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
