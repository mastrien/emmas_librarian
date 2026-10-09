import { describe, it, expect, beforeEach } from 'vitest';
import { RecoveryService, type RecoverySystemBridge } from '../RecoveryService';
import type { UpdateSafetyService } from '../UpdateSafetyService';
import type { SnapshotRestoreResult, UpdateStateRecord } from '../UpdateTypes';
import packageJson from '../../../package.json';

class FakeRecoveryBridge implements RecoverySystemBridge {
  public choiceToReturn = 0;
  public messageBoxesShown: Electron.MessageBoxSyncOptions[] = [];
  public openedUrls: string[] = [];
  public clipboardText = '';
  public quitAppCalled = false;

  public showMessageBoxSync(options: Electron.MessageBoxSyncOptions): number {
    this.messageBoxesShown.push(options);
    return this.choiceToReturn;
  }

  public async openExternal(url: string): Promise<void> {
    this.openedUrls.push(url);
  }

  public writeClipboardText(text: string): void {
    this.clipboardText = text;
  }

  public quitApp(): void {
    this.quitAppCalled = true;
  }
}

class FakeRecoverySafetyService implements Partial<UpdateSafetyService> {
  public restoreCalled = false;
  public shouldFailRestore = false;
  public libraryExisted = true;

  public restorePreUpdateSnapshot(): SnapshotRestoreResult {
    this.restoreCalled = true;
    if (this.shouldFailRestore) {
      throw new Error('Disk full');
    }
    const preRestoreBackupPath = this.libraryExisted ? 'C:/backups/pre_restore_1.db.gz' : undefined;
    return { restoredFrom: 'C:/backups/pre_update.db.gz', preRestoreBackupPath };
  }
}

describe('RecoveryService', () => {
  let bridge: FakeRecoveryBridge;
  let safety: FakeRecoverySafetyService;
  let recovery: RecoveryService;

  beforeEach(() => {
    bridge = new FakeRecoveryBridge();
    safety = new FakeRecoverySafetyService();
    recovery = new RecoveryService(safety as UpdateSafetyService, bridge);
  });

  it('builds comprehensive error report string', () => {
    const state: UpdateStateRecord = {
      status: 'failed',
      fromVersion: '1.1.2',
      targetVersion: '1.2.0',
      snapshotPath: 'C:/backups/pre_update.db.gz',
    };

    const report = recovery.buildErrorReport('Database connection error', state);

    expect(report).toContain('From Version: 1.1.2');
    expect(report).toContain('Target Version: 1.2.0');
    expect(report).toContain('Snapshot Path: C:/backups/pre_update.db.gz');
    expect(report).toContain('Error Detail: Database connection error');
  });

  it('restores snapshot and shows success dialog when user chooses restore (choice 0)', () => {
    bridge.choiceToReturn = 0;
    const state: UpdateStateRecord = { status: 'failed', fromVersion: '1.1.2', targetVersion: '1.2.0' };

    recovery.handlePostUpdateFailure('Corruption error', state);

    expect(safety.restoreCalled).toBe(true);
    expect(bridge.messageBoxesShown).toHaveLength(2); // Prompt + Success info
    expect(bridge.messageBoxesShown[1].type).toBe('info');
    expect(bridge.messageBoxesShown[1].detail).toContain('C:/backups/pre_restore_1.db.gz');
    expect(bridge.quitAppCalled).toBe(true);
  });

  it('shows error dialog when snapshot restore throws during recovery', () => {
    bridge.choiceToReturn = 0;
    safety.shouldFailRestore = true;

    recovery.handlePostUpdateFailure('Corruption error');

    expect(safety.restoreCalled).toBe(true);
    expect(bridge.messageBoxesShown[1].type).toBe('error');
    expect(bridge.messageBoxesShown[1].title).toBe('Erro na Restauração');
    expect(bridge.quitAppCalled).toBe(true);
  });

  it('opens stable releases URL when user chooses download (choice 1)', () => {
    bridge.choiceToReturn = 1;
    const state: UpdateStateRecord = { status: 'failed', fromVersion: '1.1.2', targetVersion: '1.2.0' };

    recovery.handlePostUpdateFailure('Migration failed', state);

    expect(safety.restoreCalled).toBe(false);
    // The link must point at the repository the app is published from (#16 shipped another owner).
    expect(bridge.openedUrls).toEqual([`${packageJson.repository}/releases/tag/v1.1.2`]);
  });

  it('copies error report to clipboard when user chooses copy (choice 2)', () => {
    bridge.choiceToReturn = 2;
    const state: UpdateStateRecord = { status: 'failed', fromVersion: '1.1.2', targetVersion: '1.2.0' };

    recovery.handlePostUpdateFailure('Table missing', state);

    expect(bridge.clipboardText).toContain('Table missing');
    expect(bridge.clipboardText).toContain('From Version: 1.1.2');
    expect(bridge.quitAppCalled).toBe(true);
  });

  it('quits app directly when user chooses exit (choice 3)', () => {
    bridge.choiceToReturn = 3;

    recovery.handlePostUpdateFailure('Table missing');

    expect(safety.restoreCalled).toBe(false);
    expect(bridge.quitAppCalled).toBe(true);
  });

  it('does not mention a saved copy when there was no library to save', () => {
    bridge.choiceToReturn = 0;
    safety.libraryExisted = false;

    recovery.handlePostUpdateFailure('Corruption error', { status: 'failed', fromVersion: '1.1.2' });

    expect(bridge.messageBoxesShown[1].detail).toBe(
      'Os dados voltaram ao estado da versão v1.1.2, mas o programa continua na versão nova. ' +
        'Se ela falhar de novo, instale a versão v1.1.2 pela página de versões e abra o app em seguida.',
    );
  });

  it('says the installed program is unchanged, not that the previous version will run', () => {
    bridge.choiceToReturn = 0;

    recovery.handlePostUpdateFailure('Corruption error', { status: 'failed', fromVersion: '1.1.2' });

    const { message, detail } = bridge.messageBoxesShown[1];
    expect(`${message} ${detail}`).toContain('o programa continua na versão nova');
    expect(`${message} ${detail}`).not.toMatch(/execute novamente/);
  });

  it('falls back to "anterior" when the state has no previous version', () => {
    bridge.choiceToReturn = 0;

    recovery.handlePostUpdateFailure('Corruption error', { status: 'failed' });

    expect(bridge.messageBoxesShown[1].detail).toContain('estado da versão anterior');
  });
});
