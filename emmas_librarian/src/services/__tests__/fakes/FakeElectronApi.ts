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

  lastInvocation(): RecordedInvocation | undefined {
    return this.invocations[this.invocations.length - 1];
  }

  private async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    this.invocations.push({ channel, args });
    if (this.failures.has(channel)) throw this.failures.get(channel);
    return this.responses.get(channel) ?? null;
  }

  private asBridge(): ElectronApi {
    return {
      invoke: (channel, ...args) => this.invoke(channel, ...args),
      on: () => undefined,
      getPathForFile: (file) => file.name,
    };
  }
}
