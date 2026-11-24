import { describe, it, expect, beforeEach } from 'vitest';
import { IpcChannel, type RemoteAccessStatus, type RemotePairingInvite } from '../../types';
import { registerRemoteAccessHandlers, type RemoteAccessControls } from '../handlers/remoteAccessHandlers';
import { FakeIpcMain } from './fakes/FakeIpcMain';

const OFF: RemoteAccessStatus = {
  enabled: false,
  running: false,
  port: null,
  addresses: ['192.168.0.10'],
  fingerprint: null,
  devices: [],
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
});
