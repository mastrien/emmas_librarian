import type { RemoteAccessSettings } from '../../RemoteAccessService';

/**
 * The library's settings as a map, for what the LAN server remembers (on/off, port).
 *
 * Usage:
 *   const settings = new FakeSettings({ remote_access_enabled: 'true' });
 */
export class FakeSettings implements RemoteAccessSettings {
  readonly values = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) this.values.set(key, value);
  }

  getSetting(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setSetting(key: string, value: string): void {
    this.values.set(key, value);
  }
}
