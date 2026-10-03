import { describe, it, expect, vi, beforeEach } from 'vitest';

const electronCalls = vi.hoisted(() => ({ log: [] as unknown[][] }));

// The default bridge is the only code that touches Electron's dialog/shell/clipboard/app directly.
vi.mock('electron', () => ({
  dialog: { showMessageBoxSync: (...args: unknown[]) => (electronCalls.log.push(['dialog', ...args]), 2) },
  shell: { openExternal: async (...args: unknown[]) => void electronCalls.log.push(['shell', ...args]) },
  clipboard: { writeText: (...args: unknown[]) => void electronCalls.log.push(['clipboard', ...args]) },
  app: { quit: () => void electronCalls.log.push(['quit']) },
}));

import { defaultRecoveryBridge } from '../RecoveryService';

describe('defaultRecoveryBridge', () => {
  beforeEach(() => {
    electronCalls.log = [];
  });

  it('forwards each call to the matching Electron API', async () => {
    const choice = defaultRecoveryBridge.showMessageBoxSync({ message: 'falhou' });
    await defaultRecoveryBridge.openExternal('https://example.org');
    defaultRecoveryBridge.writeClipboardText('relatório');
    defaultRecoveryBridge.quitApp();

    expect(choice).toBe(2);
    expect(electronCalls.log).toEqual([
      ['dialog', { message: 'falhou' }],
      ['shell', 'https://example.org'],
      ['clipboard', 'relatório'],
      ['quit'],
    ]);
  });
});
