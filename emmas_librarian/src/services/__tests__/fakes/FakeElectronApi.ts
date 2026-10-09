export interface RecordedInvocation {
  channel: string;
  args: unknown[];
}

type ElectronApi = Window['electronAPI'];

/**
 * Named fake for `window.electronAPI`: records every `invoke` and answers with
 * per-channel responses or failures, so tests exercise the real `api.ts`
 * wrapper instead of mocking the whole services module.
 *
 * Usage:
 *   const bridge = FakeElectronApi.install();
 *   bridge.respondWith('projects:getAll', [project]);
 *   await projectService.getProjects();
 *   expect(bridge.lastInvocation()).toEqual({ channel: 'projects:getAll', args: [] });
 */
export class FakeElectronApi {
  readonly invocations: RecordedInvocation[] = [];
  private readonly responses = new Map<string, unknown>();
  private readonly failures = new Map<string, unknown>();
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  static install(): FakeElectronApi {
    const fake = new FakeElectronApi();
    // setupTests.ts defines electronAPI as writable but non-configurable, so assign rather than redefine.
    window.electronAPI = fake.asBridge();
    return fake;
  }

  respondWith(channel: string, value: unknown): void {
    this.responses.set(channel, value);
  }

  failWith(channel: string, error: unknown): void {
    this.failures.set(channel, error);
  }

  /** Sends a main-process event to every renderer listener on the channel. */
  emit(channel: string, payload: unknown): void {
    this.listeners.get(channel)?.forEach((listener) => listener(payload));
  }

  listenerCount(channel: string): number {
    return this.listeners.get(channel)?.size ?? 0;
  }

  lastInvocation(): RecordedInvocation | undefined {
    return this.invocations[this.invocations.length - 1];
  }

  private async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    this.invocations.push({ channel, args });
    if (this.failures.has(channel)) throw this.failures.get(channel);
    return this.responses.get(channel) ?? null;
  }

  private listen(channel: string, callback: (...args: unknown[]) => void): () => void {
    const channelListeners = this.listeners.get(channel) ?? new Set();
    channelListeners.add(callback);
    this.listeners.set(channel, channelListeners);
    return () => channelListeners.delete(callback);
  }

  private asBridge(): ElectronApi {
    return {
      invoke: (channel, ...args) => this.invoke(channel, ...args),
      on: (channel, callback) => this.listen(channel, callback),
      getPathForFile: (file) => file.name,
    };
  }
}
