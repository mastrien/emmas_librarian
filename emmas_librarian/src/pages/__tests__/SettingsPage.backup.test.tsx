import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

const renderPage = async () => {
  render(
    <BrowserRouter>
      <SettingsPage />
    </BrowserRouter>,
  );
  // The page loads settings, the trash and the auto-backup list on mount; wait for the last step.
  await waitFor(() => expect(fakeService.getAppVersion).toHaveBeenCalled());
};
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('SettingsPage backups', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('automatic backups', () => {
    it('lists the automatic backups with their date and size', async () => {
      fakeService.listAutoBackups.mockResolvedValue([
        { filename: 'emma_backup_2026-09-28.db.gz', date: '2026-09-28', sizeBytes: 2048 },
        { filename: 'emma_backup_2026-09-27.db.gz', date: '2026-09-27', sizeBytes: 1536 },
      ]);

      await renderPage();

      expect(await screen.findByText('2026-09-28')).toBeInTheDocument();
      expect(screen.getByText('2.0 KB (gzip)')).toBeInTheDocument();
      expect(screen.getByText('1.5 KB (gzip)')).toBeInTheDocument();
    });

    it('says when there is no automatic backup yet', async () => {
      await renderPage();

      expect(await screen.findByText('Nenhum backup automático disponível ainda.')).toBeInTheDocument();
    });

    it('saves the choice to turn automatic backups off', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('checkbox', { name: /Habilitar backups automáticos/ }));

      await waitFor(() => expect(fakeService.setSetting).toHaveBeenCalledWith('enable_auto_backups', 'false'));
    });

    it('restores the chosen automatic backup after confirmation', async () => {
      fakeService.listAutoBackups.mockResolvedValue([
        { filename: 'emma_backup_2026-09-28.db.gz', date: '2026-09-28', sizeBytes: 2048 },
      ]);
      await renderPage();
      const row = (await screen.findByText('2026-09-28')).closest('div')!.parentElement!;

      fireEvent.click(within(row).getByRole('button', { name: /Restaurar/ }));

      await waitFor(() => expect(fakeService.restoreAutoBackup).toHaveBeenCalledWith('emma_backup_2026-09-28.db.gz'));
    });

    // Automatic backups hold only the database: the warning must not promise (or threaten) the PDFs.
    it('warns that only the database goes back to the backup date', async () => {
      fakeService.listAutoBackups.mockResolvedValue([
        { filename: 'emma_backup_2026-09-28.db.gz', date: '2026-09-28', sizeBytes: 2048 },
      ]);
      await renderPage();
      const row = (await screen.findByText('2026-09-28')).closest('div')!.parentElement!;

      fireEvent.click(within(row).getByRole('button', { name: /Restaurar/ }));

      const warning = vi.mocked(window.confirm).mock.calls[0][0];
      expect(warning).toContain('Os PDFs e documentos guardados não são alterados');
      expect(warning).not.toContain('PDFs, etc');
    });

    it('does not restore an automatic backup when the warning is declined', async () => {
      fakeService.listAutoBackups.mockResolvedValue([
        { filename: 'emma_backup_2026-09-28.db.gz', date: '2026-09-28', sizeBytes: 2048 },
      ]);
      vi.mocked(window.confirm).mockReturnValue(false);
      await renderPage();
      const row = (await screen.findByText('2026-09-28')).closest('div')!.parentElement!;

      fireEvent.click(within(row).getByRole('button', { name: /Restaurar/ }));

      expect(fakeService.restoreAutoBackup).not.toHaveBeenCalled();
    });

    it('alerts when an automatic backup cannot be restored', async () => {
      fakeService.listAutoBackups.mockResolvedValue([
        { filename: 'emma_backup_2026-09-28.db.gz', date: '2026-09-28', sizeBytes: 2048 },
      ]);
      fakeService.restoreAutoBackup.mockRejectedValue(new Error('corrompido'));
      await renderPage();
      const row = (await screen.findByText('2026-09-28')).closest('div')!.parentElement!;

      fireEvent.click(within(row).getByRole('button', { name: /Restaurar/ }));

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao restaurar backup automático.'));
    });
  });

  describe('full backup', () => {
    it('tells where the full backup was saved', async () => {
      fakeService.exportBackup.mockResolvedValue('C:\\Backups\\backup_2026-09-28.emmabak');
      await renderPage();

      click('Criar Backup Completo');

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          'Backup completo criado com sucesso em:\nC:\\Backups\\backup_2026-09-28.emmabak',
        ),
      );
    });

    it('stays quiet when the save dialog is cancelled', async () => {
      await renderPage();

      click('Criar Backup Completo');

      await waitFor(() => expect(fakeService.exportBackup).toHaveBeenCalled());
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('alerts when the full backup fails', async () => {
      fakeService.exportBackup.mockRejectedValue(new Error('disco cheio'));
      await renderPage();

      click('Criar Backup Completo');

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao criar backup completo.'));
    });
  });

  describe('restore and overwrite', () => {
    it('does nothing when the overwrite warning is declined', async () => {
      vi.mocked(window.confirm).mockReturnValue(false);
      await renderPage();

      click('Restaurar e Sobrescrever');

      expect(fakeService.restoreBackupOverride).not.toHaveBeenCalled();
    });

    it('says the restore was cancelled when no file is chosen', async () => {
      await renderPage();

      click('Restaurar e Sobrescrever');

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Restauração cancelada pelo usuário.'));
    });

    it('stays quiet while the app restarts after a restore', async () => {
      fakeService.restoreBackupOverride.mockResolvedValue(true);
      await renderPage();

      click('Restaurar e Sobrescrever');

      await waitFor(() => expect(fakeService.restoreBackupOverride).toHaveBeenCalled());
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('alerts when the restore fails', async () => {
      fakeService.restoreBackupOverride.mockRejectedValue(new Error('sem emma.db'));
      await renderPage();

      click('Restaurar e Sobrescrever');

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao restaurar backup.'));
    });
  });

  describe('import and merge', () => {
    it('tells how many new projects were merged', async () => {
      fakeService.restoreBackupMerge.mockResolvedValue(2);
      await renderPage();

      click('Importar e Mesclar');

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith('2 projetos novos foram importados e mesclados com sucesso!'),
      );
    });

    it('uses the singular for a single merged project', async () => {
      fakeService.restoreBackupMerge.mockResolvedValue(1);
      await renderPage();

      click('Importar e Mesclar');

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith('1 projeto novo foi importado e mesclado com sucesso!'),
      );
    });

    // Cancelling the file dialog used to return 0 too, so it announced "Nenhum projeto novo encontrado".
    it('stays quiet when the file dialog is cancelled', async () => {
      fakeService.restoreBackupMerge.mockResolvedValue(null);
      await renderPage();

      click('Importar e Mesclar');

      await waitFor(() => expect(fakeService.restoreBackupMerge).toHaveBeenCalled());
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('says when every project of the backup already exists', async () => {
      await renderPage();

      click('Importar e Mesclar');

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/^Nenhum projeto novo/)));
    });

    it('alerts when the merge fails', async () => {
      fakeService.restoreBackupMerge.mockRejectedValue(new Error('zip inválido'));
      await renderPage();

      click('Importar e Mesclar');

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro ao mesclar backup.'));
    });
  });
});
