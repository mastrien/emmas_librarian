import { describe, it, expect, beforeEach } from 'vitest';
import {
  IpcChannel,
  type PendingPhoneChange,
  type PhoneChangeDecision,
  type RemoteAccessStatus,
  type RemotePairingInvite,
} from '../../types';
import { registerRemoteAccessHandlers, type RemoteAccessControls } from '../handlers/remoteAccessHandlers';
import { FakeIpcMain } from './fakes/FakeIpcMain';

const OFF: RemoteAccessStatus = {
  enabled: false,
  running: false,
  port: null,
  addresses: ['192.168.0.10'],
  fingerprint: null,
  devices: [],
  syncDevice: null,
  error: null,
};

/** The LAN server as the settings screen drives it: records each call and answers a plausible state. */
class FakeRemoteAccess implements RemoteAccessControls {
  readonly calls: string[] = [];

  status(): RemoteAccessStatus {
    return OFF;
  }

  async setEnabled(enabled: boolean): Promise<RemoteAccessStatus> {
    this.calls.push(`setEnabled(${enabled})`);
    return { ...OFF, enabled, running: enabled };
  }

  async startPairing(): Promise<RemotePairingInvite> {
    this.calls.push('startPairing()');
    return {
      url: 'https://192.168.0.10:47810/#pair=abc',
      expiresAt: '2026-11-14T10:05:00.000Z',
      fingerprint: 'AB',
      qrSvg: '<svg/>',
    };
  }

  cancelPairing(): void {
    this.calls.push('cancelPairing()');
  }

  revokeDevice(id: string): RemoteAccessStatus {
    this.calls.push(`revokeDevice(${id})`);
    return OFF;
  }

  async startSyncPairing(): Promise<RemotePairingInvite> {
    this.calls.push('startSyncPairing()');
    return {
      url: 'https://192.168.0.10:47810/#sync=abc',
      expiresAt: '2026-11-14T10:05:00.000Z',
      fingerprint: 'AB',
      qrSvg: '<svg/>',
    };
  }

  revokeSyncDevice(): RemoteAccessStatus {
    this.calls.push('revokeSyncDevice()');
    return OFF;
  }

  listPhoneChanges(): PendingPhoneChange[] {
    this.calls.push('listPhoneChanges()');
    return [];
  }

  applyPhoneChanges(opIds: string[]): PhoneChangeDecision[] {
    this.calls.push(`applyPhoneChanges(${opIds.join(',')})`);
    return opIds.map((opId) => ({ opId, status: 'applied', reason: null }));
  }

  rejectPhoneChanges(opIds: string[]): PhoneChangeDecision[] {
    this.calls.push(`rejectPhoneChanges(${opIds.join(',')})`);
    return opIds.map((opId) => ({ opId, status: 'rejected', reason: null }));
  }
}

describe('remote access handlers', () => {
  let ipc: FakeIpcMain;
  let remote: FakeRemoteAccess;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    remote = new FakeRemoteAccess();
    registerRemoteAccessHandlers(ipc, remote);
  });

  it('answers the status', async () => {
    expect(await ipc.invoke(IpcChannel.REMOTE_ACCESS_GET_STATUS)).toEqual(OFF);
  });

  it('turns the server on only for a real true, and off for anything else', async () => {
    expect(await ipc.invoke(IpcChannel.REMOTE_ACCESS_SET_ENABLED, true)).toMatchObject({ enabled: true });
    await ipc.invoke(IpcChannel.REMOTE_ACCESS_SET_ENABLED, 'true');
    await ipc.invoke(IpcChannel.REMOTE_ACCESS_SET_ENABLED, false);

    expect(remote.calls).toEqual(['setEnabled(true)', 'setEnabled(false)', 'setEnabled(false)']);
  });

  it('opens and cancels a pairing invite', async () => {
    expect(await ipc.invoke(IpcChannel.REMOTE_ACCESS_START_PAIRING)).toMatchObject({ qrSvg: '<svg/>' });
    await ipc.invoke(IpcChannel.REMOTE_ACCESS_CANCEL_PAIRING);

    expect(remote.calls).toEqual(['startPairing()', 'cancelPairing()']);
  });

  it('revokes the device named', async () => {
    await ipc.invoke(IpcChannel.REMOTE_ACCESS_REVOKE_DEVICE, 'd-1');

    expect(remote.calls).toEqual(['revokeDevice(d-1)']);
  });

  it('opens a sync pairing and revokes the paired phone', async () => {
    expect(await ipc.invoke(IpcChannel.REMOTE_ACCESS_START_SYNC_PAIRING)).toMatchObject({ qrSvg: '<svg/>' });
    await ipc.invoke(IpcChannel.REMOTE_ACCESS_REVOKE_SYNC_DEVICE);
    expect(remote.calls).toEqual(['startSyncPairing()', 'revokeSyncDevice()']);
  });

  it('lists what the phone changed, and applies or rejects the chosen ones', async () => {
    expect(await ipc.invoke(IpcChannel.REMOTE_ACCESS_LIST_PHONE_CHANGES)).toEqual([]);
    expect(await ipc.invoke(IpcChannel.REMOTE_ACCESS_APPLY_PHONE_CHANGES, ['a', 'b'])).toEqual([
      { opId: 'a', status: 'applied', reason: null },
      { opId: 'b', status: 'applied', reason: null },
    ]);
    await ipc.invoke(IpcChannel.REMOTE_ACCESS_REJECT_PHONE_CHANGES, ['c']);
    expect(remote.calls).toEqual(['listPhoneChanges()', 'applyPhoneChanges(a,b)', 'rejectPhoneChanges(c)']);
  });

  it('refuses ids that are not a list of strings, showing the value', async () => {
    await expect(ipc.invoke(IpcChannel.REMOTE_ACCESS_APPLY_PHONE_CHANGES, 'a')).rejects.toThrow(
      /Expected a list of operation ids \(strings\), got \\"a\\"/,
    );
    await expect(ipc.invoke(IpcChannel.REMOTE_ACCESS_REJECT_PHONE_CHANGES, [1])).rejects.toThrow('got [1]');
    expect(remote.calls).toEqual([]);
  });
});
