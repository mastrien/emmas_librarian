import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';
import { FakeDialogs, FakeDialogsProvider } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
let dialogs = new FakeDialogs();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

const TRASHED = { type: 'article', id: 7, title: 'Artigo na lixeira', deleted_at: '2026-11-01T10:00:00Z' };
const BACKUP = { filename: 'emma_backup_2026-09-28.db.gz', date: '2026-09-28', sizeBytes: 2048 };

const renderPage = async () => {
  render(
    <BrowserRouter>
      <FakeDialogsProvider dialogs={dialogs}>
        <SettingsPage />
      </FakeDialogsProvider>
    </BrowserRouter>,
  );
  await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());
};

/**
 * Waits until the question was asked and answered: the answer is a promise now (it was window.confirm), so an
 * assertion right after the click would pass before the action could even run.
 */
const answered = async () => {
  await waitFor(() => expect(dialogs.asked).toHaveLength(1));
  await act(async () => {});
};

// Each destructive action of the page, how to start it and what it would call (Arca 134, the app's own dialogs).
const ACTIONS = [
  {
    name: 'Restaurar padrões de IA',
    // Settings come back to the defaults, nothing is deleted: a plain button.
    danger: false,
    start: () => fireEvent.click(screen.getByRole('button', { name: /Restaurar Padrões/ })),
    call: () => fakeService.restoreAiModelConfigDefaults,
  },
  {
    name: 'Excluir permanentemente',
    danger: true,
    start: async () => {
      const row = (await screen.findByText('Artigo na lixeira')).closest('.trash-item') as HTMLElement;
      fireEvent.click(within(row).getByRole('button', { name: /Excluir/ }));
    },
    call: () => fakeService.deleteTrashItemPermanent,
  },
  {
    name: 'Esvaziar lixeira',
    danger: true,
    start: async () => fireEvent.click(await screen.findByRole('button', { name: /Esvaziar Lixeira/ })),
    call: () => fakeService.emptyTrash,
  },
  {
    name: 'Restaurar backup automático',
    danger: true,
    start: async () => {
      const row = (await screen.findByText('2026-09-28')).closest('div')!.parentElement!;
      fireEvent.click(within(row).getByRole('button', { name: /Restaurar/ }));
    },
    call: () => fakeService.restoreAutoBackup,
  },
  {
    name: 'Restaurar e sobrescrever',
    danger: true,
    start: () => fireEvent.click(screen.getByRole('button', { name: 'Restaurar e Sobrescrever' })),
    call: () => fakeService.restoreBackupOverride,
  },
];

describe('SettingsPage confirmations', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    fakeService.getTrashItems.mockResolvedValue([TRASHED]);
    fakeService.listAutoBackups.mockResolvedValue([BACKUP]);
    dialogs = new FakeDialogs();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ACTIONS)('$name: asks first, and does it once confirmed', async (action) => {
    await renderPage();

    await action.start();
    await answered();

    expect(dialogs.asked[0].title).toBe(action.name);
    expect(Boolean(dialogs.asked[0].danger)).toBe(action.danger);
    await waitFor(() => expect(action.call()).toHaveBeenCalledTimes(1));
  });

  it.each(ACTIONS)('$name: does nothing when declined', async (action) => {
    dialogs.confirmMessage.mockReturnValue(false);
    await renderPage();

    await action.start();
    await answered();

    expect(action.call()).not.toHaveBeenCalled();
  });
});
