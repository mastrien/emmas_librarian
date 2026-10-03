import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';
import type { UpdateStatusResponse } from '../../types';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

const statusWith = (overrides: Partial<UpdateStatusResponse>): UpdateStatusResponse => ({
  status: 'idle',
  updateInfo: null,
  downloadProgress: null,
  error: null,
  state: null,
  ...overrides,
});

const renderPage = async () => {
  const view = render(
    <BrowserRouter>
      <SettingsPage />
    </BrowserRouter>,
  );
  await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());
  return view;
};
const clickButton = async (name: string) => fireEvent.click(await screen.findByRole('button', { name }));

describe('SettingsPage updates', () => {
  let confirmSpy: MockInstance<(message?: string) => boolean>;

  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks for updates and shows the refreshed status', async () => {
    await renderPage();
    fakeService.getUpdateStatus.mockResolvedValue(statusWith({ status: 'not-available' }));

    await clickButton('Verificar Atualizações');

    await waitFor(() => expect(fakeService.checkForUpdates).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fakeService.getUpdateStatus).toHaveBeenCalledTimes(2));
  });

  it('downloads an available update only when asked', async () => {
    fakeService.getUpdateStatus.mockResolvedValue(
      statusWith({ status: 'available', updateInfo: { version: '1.3.0' } }),
    );
    await renderPage();

    await clickButton('Baixar Atualização');

    expect(fakeService.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('installs a downloaded update', async () => {
    fakeService.getUpdateStatus.mockResolvedValue(statusWith({ status: 'downloaded' }));
    await renderPage();

    await clickButton('Reiniciar e Instalar Atualização');

    expect(fakeService.installUpdate).toHaveBeenCalledTimes(1);
  });

  describe('restoring the pre-update snapshot', () => {
    const snapshotTakenAt = new Date(2026, 9, 3, 17, 45).getTime();

    beforeEach(() => {
      fakeService.getUpdateStatus.mockResolvedValue(
        statusWith({
          state: {
            status: 'verified',
            snapshotPath: 'C:/backups/pre_update_1.2.0_1.db.gz',
            timestamp: snapshotTakenAt,
          },
        }),
      );
    });

    it('asks with the snapshot date, then restores', async () => {
      await renderPage();

      await clickButton('Restaurar Dados do Snapshot Pré-Atualização');

      expect(confirmSpy.mock.calls[0][0]).toContain('03/10/2026, 17:45');
      expect(confirmSpy.mock.calls[0][0]).toContain('O banco atual é guardado em backups/');
      await waitFor(() => expect(fakeService.restoreUpdateSnapshot).toHaveBeenCalledTimes(1));
    });

    it('does nothing when the question is declined', async () => {
      confirmSpy.mockReturnValue(false);
      await renderPage();

      await clickButton('Restaurar Dados do Snapshot Pré-Atualização');

      expect(fakeService.restoreUpdateSnapshot).not.toHaveBeenCalled();
    });
  });

  it('stops listening to update events when the page closes', async () => {
    const stopStatus = vi.fn();
    const stopProgress = vi.fn();
    fakeService.onUpdateStatusChange.mockReturnValue(stopStatus);
    fakeService.onUpdateDownloadProgress.mockReturnValue(stopProgress);
    const view = await renderPage();

    view.unmount();

    expect(stopStatus).toHaveBeenCalledTimes(1);
    expect(stopProgress).toHaveBeenCalledTimes(1);
  });
});
