import { describe, it, expect, vi, beforeEach } from 'vitest';

const electronCalls = vi.hoisted(() => ({ log: [] as unknown[][] }));

// The default bridge is the only code that touches Electron's dialog/shell/clipboard/app directly.
vi.mock('electron', () => ({
  dialog: { showMessageBoxSync: (...args: unknown[]) => (electronCalls.log.push(['dialog', ...args]), 2) },
  shell: { openExternal: async (...args: unknown[]) => void electronCalls.log.push(['shell', ...args]) },
  clipboard: { writeText: (...args: unknown[]) => void electronCalls.log.push(['clipboard', ...args]) },
  app: { quit: () => void electronCalls.log.push(['quit']) },
}));

import { defaultRecoveryBridge, mockedRecoveryChoice } from '../RecoveryService';

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

describe('mockedRecoveryChoice', () => {
  it('answers with the E2E choice and logs the title and detail of the box it replaced', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const choice = mockedRecoveryChoice(
      { title: 'Erro de Atualização', message: 'm', detail: 'Erro: x\n\nEscolha' },
      { E2E_MOCK_RECOVERY_CHOICE: '3' },
    );

    expect(choice).toBe(3);
    expect(log).toHaveBeenCalledWith('[E2E recovery dialog] Erro de Atualização | Erro: x Escolha');
    log.mockRestore();
  });

  it('leaves the native box in charge outside E2E', () => {
    expect(mockedRecoveryChoice({ message: 'm' }, {})).toBeUndefined();
  });
});
