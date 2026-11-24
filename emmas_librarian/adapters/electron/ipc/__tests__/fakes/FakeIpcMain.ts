type IpcHandler = (event: FakeIpcEvent, ...args: unknown[]) => Promise<unknown>;

export interface FakeIpcEvent {
  sender: object;
}

/**
 * Named fake for Electron's `ipcMain`: stores handlers by channel and lets
 * tests invoke them like the renderer would. Mirrors Electron by refusing a
 * second handler on the same channel.
 *
 * Usage:
 *   const ipc = new FakeIpcMain();
 *   setupIpcRegistries(); // with 'electron' mocked to expose `ipc`
 *   await ipc.invoke(IpcChannel.PROJECTS_GET_ALL);
 */
export class FakeIpcMain {
  readonly sender = { id: 'fake-web-contents' };
  private readonly handlers = new Map<string, IpcHandler>();

  handle(channel: string, handler: IpcHandler): void {
    if (this.handlers.has(channel)) {
      throw new Error(`Attempted to register a second handler for '${channel}'`);
    }
    this.handlers.set(channel, handler);
  }

  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`No handler registered for '${channel}'. Registered: ${this.channels().join(', ')}`);
    return handler({ sender: this.sender }, ...args);
  }

  channels(): string[] {
    return [...this.handlers.keys()];
  }

  reset(): void {
    this.handlers.clear();
  }
}
