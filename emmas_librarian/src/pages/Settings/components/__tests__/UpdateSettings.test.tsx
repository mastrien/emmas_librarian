import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpdateSettings, describeSnapshotDate } from '../UpdateSettings';
import type { UpdateStatusResponse } from '../../../../types';

describe('UpdateSettings Component', () => {
  const baseStatus: UpdateStatusResponse = {
    status: 'idle',
    updateInfo: null,
    downloadProgress: null,
    error: null,
    state: null,
  };

  it('renders current version and triggers onCheckForUpdates when clicking check button', async () => {
    const onCheck = vi.fn().mockResolvedValue(undefined);
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={baseStatus}
        onCheckForUpdates={onCheck}
        onDownloadUpdate={vi.fn()}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('Versão Instalada: v1.2.0')).toBeInTheDocument();
    const checkBtn = screen.getByText('Verificar Atualizações');
    await act(async () => {
      fireEvent.click(checkBtn);
    });
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('displays up-to-date message when status is not-available', () => {
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={{ ...baseStatus, status: 'not-available' }}
        onCheckForUpdates={vi.fn()}
        onDownloadUpdate={vi.fn()}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Você está utilizando a versão mais recente do Emma's Librarian.")).toBeInTheDocument();
  });

  it('displays available update and triggers onDownloadUpdate', () => {
    const onDownload = vi.fn().mockResolvedValue(undefined);
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={{
          ...baseStatus,
          status: 'available',
          updateInfo: { version: '1.3.0', releaseDate: '2026-10-02', releaseNotes: 'New features' },
        }}
        onCheckForUpdates={vi.fn()}
        onDownloadUpdate={onDownload}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('Nova Versão Disponível: v1.3.0')).toBeInTheDocument();
    const downloadBtn = screen.getByText('Baixar Atualização');
    fireEvent.click(downloadBtn);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('displays download progress bar when status is downloading', () => {
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={{
          ...baseStatus,
          status: 'downloading',
          downloadProgress: { percent: 64, bytesPerSecond: 2 * 1024 * 1024, transferred: 640, total: 1000 },
        }}
        onCheckForUpdates={vi.fn()}
        onDownloadUpdate={vi.fn()}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('Baixando atualização... 64%')).toBeInTheDocument();
    expect(screen.getByText('2.00 MB/s')).toBeInTheDocument();
  });

  it('displays safety snapshot notice and install button when status is downloaded', () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={{
          ...baseStatus,
          status: 'downloaded',
        }}
        onCheckForUpdates={vi.fn()}
        onDownloadUpdate={vi.fn()}
        onInstallUpdate={onInstall}
      />,
    );

    expect(screen.getByText('Atualização pronta para instalação')).toBeInTheDocument();
    expect(
      screen.getByText(/Um snapshot de segurança do seu banco de dados será gerado automaticamente/),
    ).toBeInTheDocument();
    const installBtn = screen.getByText('Reiniciar e Instalar Atualização');
    fireEvent.click(installBtn);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('displays error message when status is error', () => {
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={{
          ...baseStatus,
          status: 'error',
          error: 'Connection timeout',
        }}
        onCheckForUpdates={vi.fn()}
        onDownloadUpdate={vi.fn()}
        onInstallUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('Erro ao processar atualização: Connection timeout')).toBeInTheDocument();
  });

  it('displays rollback section when snapshot exists', () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    render(
      <UpdateSettings
        currentVersion="1.2.0"
        updateStatus={{
          ...baseStatus,
          state: {
            status: 'failed',
            fromVersion: '1.1.2',
            targetVersion: '1.2.0',
            snapshotPath: '/backups/pre_update_1.1.2.db.gz',
          },
        }}
        onCheckForUpdates={vi.fn()}
        onDownloadUpdate={vi.fn()}
        onInstallUpdate={vi.fn()}
        onRestoreSnapshot={onRestore}
      />,
    );

    expect(screen.getByText('Rollback de Emergência')).toBeInTheDocument();
    expect(screen.getByText(/Snapshot de antes da última atualização/)).toBeInTheDocument();
    expect(screen.getByText(/Restaurar desfaz o que foi feito depois dessa data/)).toBeInTheDocument();
    const restoreBtn = screen.getByText('Restaurar Dados do Snapshot Pré-Atualização');
    fireEvent.click(restoreBtn);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

describe('describeSnapshotDate', () => {
  it('formats the snapshot timestamp in Brazilian date and time', () => {
    const timestamp = new Date(2026, 9, 3, 17, 45).getTime();

    expect(describeSnapshotDate(timestamp)).toBe('03/10/2026, 17:45');
  });

  it('falls back to a relative description without a timestamp', () => {
    expect(describeSnapshotDate(undefined)).toBe('antes da última atualização');
  });
});
