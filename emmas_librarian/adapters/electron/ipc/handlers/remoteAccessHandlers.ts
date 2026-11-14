import { IpcChannel } from '../../types';
import type { RemoteAccessService } from '../../remote/RemoteAccessService';
import { handle, type IpcRegistrar } from './handle';

/** The part of the service the settings screen drives, so tests can stand in for it with a named fake. */
export type RemoteAccessControls = Pick<
  RemoteAccessService,
  'status' | 'setEnabled' | 'startPairing' | 'cancelPairing' | 'revokeDevice'
>;

/**
 * The desktop's controls of the LAN server (#32): turn it on or off, show a pairing QR code, revoke a
 * phone. Desktop only on purpose: who may reach the library is decided by who sits at the computer.
 *
 * Usage:
 *   registerRemoteAccessHandlers(ipcMain, remoteAccess);
 */
export function registerRemoteAccessHandlers(ipc: IpcRegistrar, remote: RemoteAccessControls): void {
  handle(ipc, IpcChannel.REMOTE_ACCESS_GET_STATUS, () => remote.status());
  handle(ipc, IpcChannel.REMOTE_ACCESS_SET_ENABLED, (_e, enabled: unknown) => remote.setEnabled(enabled === true));
  handle(ipc, IpcChannel.REMOTE_ACCESS_START_PAIRING, () => remote.startPairing());
  handle(ipc, IpcChannel.REMOTE_ACCESS_CANCEL_PAIRING, () => remote.cancelPairing());
  handle(ipc, IpcChannel.REMOTE_ACCESS_REVOKE_DEVICE, (_e, deviceId: string) => remote.revokeDevice(String(deviceId)));
}
