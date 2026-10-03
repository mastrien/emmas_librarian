import { app, dialog, shell, clipboard } from 'electron';
import type { UpdateSafetyService } from './UpdateSafetyService';
import type { UpdateStateRecord } from './UpdateTypes';

// package.json "repository"; a wrong owner here sends users in trouble to a 404.
const RELEASES_URL = 'https://github.com/mastrien/emmas_librarian/releases';

export interface RecoverySystemBridge {
  showMessageBoxSync(options: Electron.MessageBoxSyncOptions): number;
  openExternal(url: string): Promise<void>;
  writeClipboardText(text: string): void;
  quitApp(): void;
}

export const defaultRecoveryBridge: RecoverySystemBridge = {
  showMessageBoxSync: (options) => dialog.showMessageBoxSync(options),
  openExternal: (url) => shell.openExternal(url),
  writeClipboardText: (text) => clipboard.writeText(text),
  quitApp: () => app.quit(),
};

/**
 * Provides emergency recovery and rollback options when post-update startup verification fails.
 *
 * Usage:
 *   const recovery = new RecoveryService(safetyService);
 *   recovery.handlePostUpdateFailure(error, state);
 */
export class RecoveryService {
  constructor(
    private readonly safetyService: UpdateSafetyService,
    private readonly bridge: RecoverySystemBridge = defaultRecoveryBridge,
  ) {}

  public buildErrorReport(error: string, state?: UpdateStateRecord | null): string {
    return [
      "=== Emma's Librarian Update Recovery Report ===",
      `Timestamp: ${new Date().toISOString()}`,
      `From Version: ${state?.fromVersion || 'unknown'}`,
      `Target Version: ${state?.targetVersion || 'unknown'}`,
      `Snapshot Path: ${state?.snapshotPath || 'none'}`,
      `Error Detail: ${error}`,
      '==============================================',
    ].join('\n');
  }

  public handlePostUpdateFailure(error: string, state?: UpdateStateRecord | null): void {
    const report = this.buildErrorReport(error, state);
    const targetVersion = state?.targetVersion || 'recente';
    const choice = this.promptRecoveryOptions(targetVersion, error);

    this.processUserChoice(choice, report, state);
  }

  private promptRecoveryOptions(targetVersion: string, error: string): number {
    return this.bridge.showMessageBoxSync({
      type: 'error',
      title: "Emma's Librarian - Erro de Atualização",
      message: `A atualização para a versão v${targetVersion} encontrou uma falha de validação.`,
      detail: `Erro: ${error}\n\nSeus dados estão protegidos no snapshot pré-atualização. Escolha uma ação:`,
      buttons: [
        'Restaurar Dados Anteriores (Recomendado)',
        'Baixar Versão Estável Anterior',
        'Copiar Relatório de Erro',
        'Sair',
      ],
      defaultId: 0,
      cancelId: 3,
    });
  }

  private processUserChoice(choice: number, report: string, state?: UpdateStateRecord | null): void {
    if (choice === 0) {
      this.executeSnapshotRollback(state);
    } else if (choice === 1) {
      this.openReleasesUrl(state?.fromVersion);
    } else if (choice === 2) {
      this.bridge.writeClipboardText(report);
      this.bridge.quitApp();
    } else {
      this.bridge.quitApp();
    }
  }

  private executeSnapshotRollback(state?: UpdateStateRecord | null): void {
    try {
      const { preRestoreBackupPath } = this.safetyService.restorePreUpdateSnapshot();
      const savedCopy = preRestoreBackupPath
        ? `

O banco de antes da restauração foi guardado em:
${preRestoreBackupPath}`
        : '';
      this.bridge.showMessageBoxSync({
        type: 'info',
        title: 'Restauração Concluída',
        message: 'O banco de dados foi restaurado para a versão anterior com sucesso.',
        detail: `Por favor, execute novamente a versão estável v${state?.fromVersion || 'anterior'}.${savedCopy}`,
        buttons: ['OK'],
      });
    } catch (err: unknown) {
      this.bridge.showMessageBoxSync({
        type: 'error',
        title: 'Erro na Restauração',
        message: 'Não foi possível restaurar automaticamente o snapshot.',
        detail: String(err),
        buttons: ['OK'],
      });
    }
    this.bridge.quitApp();
  }

  private openReleasesUrl(fromVersion?: string): void {
    const url = fromVersion ? `${RELEASES_URL}/tag/v${fromVersion}` : RELEASES_URL;
    this.bridge.openExternal(url).finally(() => this.bridge.quitApp());
  }
}
