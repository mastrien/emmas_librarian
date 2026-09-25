import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { withErrorHandling } from '../errorHandler';

export type IpcRegistrar = Pick<IpcMain, 'handle'>;

// `never[]` accepts handlers with any concrete parameter list while keeping IPC args untyped at the boundary.
export type ChannelHandler = (event: IpcMainInvokeEvent, ...args: never[]) => unknown;

/**
 * Registers an IPC handler whose failures reach the renderer as serialized AppErrors.
 *
 * Usage:
 *   handle(ipc, IpcChannel.PROJECTS_GET_ONE, (_event, id: number) => db.getProject(id));
 */
export function handle(ipc: IpcRegistrar, channel: string, handler: ChannelHandler): void {
  ipc.handle(
    channel,
    withErrorHandling(async (event: IpcMainInvokeEvent, ...args: unknown[]) => handler(event, ...(args as never[]))),
  );
}
