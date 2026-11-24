// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Electron's dialog, pressing the button it is told to and remembering the window. */
const fakeDialog = vi.hoisted(() => ({ pressed: 0, shown: [] as unknown[], showMessageBoxSync: vi.fn() }));
vi.mock('electron', () => ({ dialog: fakeDialog }));

import { askWhileInstalling, installingDialogText } from '../updateInstallDialog';

beforeEach(() => {
  fakeDialog.shown = [];
  fakeDialog.showMessageBoxSync.mockReset().mockImplementation((options: unknown) => {
    fakeDialog.shown.push(options);
    return fakeDialog.pressed;
  });
});

describe('installingDialogText', () => {
  it('names the version being installed and recommends waiting', () => {
    const { message, detail } = installingDialogText('1.4.0');
    expect(message).toContain('v1.4.0');
    expect(detail).toContain('fechar e aguardar');
  });
});

describe('askWhileInstalling', () => {
  it('answers quit when "Fechar e aguardar" is pressed, and shows it as the default and the way out', () => {
    fakeDialog.pressed = 0;
    expect(askWhileInstalling('1.4.0', {})).toBe('quit');
    expect(fakeDialog.shown[0]).toMatchObject({
      defaultId: 0,
      cancelId: 0,
      buttons: ['Fechar e aguardar', 'Abrir mesmo assim'],
    });
  });

  it('answers open only when "Abrir mesmo assim" is pressed', () => {
    fakeDialog.pressed = 1;
    expect(askWhileInstalling('1.4.0', {})).toBe('open');
  });

  it.each(['quit', 'open'] as const)('E2E_UPDATE_GUARD_CHOICE=%s answers without opening a window', (choice) => {
    expect(askWhileInstalling('1.4.0', { E2E_UPDATE_GUARD_CHOICE: choice })).toBe(choice);
    expect(fakeDialog.showMessageBoxSync).not.toHaveBeenCalled();
  });

  it('ignores a forced answer that is neither quit nor open', () => {
    fakeDialog.pressed = 0;
    expect(askWhileInstalling('1.4.0', { E2E_UPDATE_GUARD_CHOICE: 'maybe' })).toBe('quit');
    expect(fakeDialog.showMessageBoxSync).toHaveBeenCalledOnce();
  });
});
