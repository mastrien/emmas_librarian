import type { Prompter } from '../../../core/cli/terminalConfirmer';

/** What the prompter needs from Electron's `dialog.showMessageBox`: the buttons and which one was pressed. */
export type ShowMessageBox = (options: {
  type: 'question';
  title: string;
  message: string;
  buttons: string[];
  defaultId: number;
  cancelId: number;
  noLink: true;
}) => Promise<{ response: number }>;

const SUFFIX = /\s*\[s\/N\]\s*$/;

/**
 * Asks the person in a native window. The CLI runs inside the app's executable, which on Windows is a window program: its
 * stdin arrives empty and its stderr is not shown, so a question on the terminal would never be seen or answered. The
 * default button, and closing the window, are both "Não".
 *
 * Usage:
 *   const prompter = new DialogPrompter(dialog.showMessageBox.bind(dialog));
 */
export class DialogPrompter implements Prompter {
  constructor(private readonly showMessageBox: ShowMessageBox) {}

  async ask(question: string): Promise<string | null> {
    const { response } = await this.showMessageBox({
      type: 'question',
      title: "Emma's Librarian: agente local",
      message: question.replace(SUFFIX, ''),
      buttons: ['Sim', 'Não'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    return response === 0 ? 's' : 'n';
  }
}
