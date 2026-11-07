import React, { type ReactNode } from 'react';
import { vi } from 'vitest';
import { DialogsContext, type ConfirmOptions, type Dialogs, type InformOptions } from '../../DialogProvider';

/**
 * Answers the app's confirm/message windows without drawing them, and records what was asked. confirmMessage and
 * informMessage receive the message, as window.confirm and window.alert did, so the tests that used those read the
 * same.
 *
 * @example const dialogs = new FakeDialogs(); dialogs.confirmMessage.mockReturnValue(false);
 */
export class FakeDialogs implements Dialogs {
  confirmMessage = vi.fn<(message: ReactNode) => boolean>(() => true);
  informMessage = vi.fn<(message: ReactNode) => void>();
  asked: ConfirmOptions[] = [];
  informed: InformOptions[] = [];

  confirm = async (options: ConfirmOptions): Promise<boolean> => {
    this.asked.push(options);
    return this.confirmMessage(options.message);
  };

  inform = async (options: InformOptions): Promise<void> => {
    this.informed.push(options);
    this.informMessage(options.message);
  };
}

/**
 * Puts a FakeDialogs where a DialogProvider would be.
 *
 * @example render(<FakeDialogsProvider dialogs={dialogs}><SettingsPage /></FakeDialogsProvider>)
 */
export const FakeDialogsProvider: React.FC<{ dialogs?: Dialogs; children: ReactNode }> = ({ dialogs, children }) => (
  <DialogsContext.Provider value={dialogs ?? new FakeDialogs()}>{children}</DialogsContext.Provider>
);
