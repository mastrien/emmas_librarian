// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DialogPrompter, type ShowMessageBox } from '../dialogPrompter';

/** Presses the button it was told to and remembers the window it was asked to show. */
class FakeWindow {
  readonly shown: Array<Parameters<ShowMessageBox>[0]> = [];
  constructor(private readonly pressed: number) {}
  readonly show: ShowMessageBox = async (options) => (this.shown.push(options), { response: this.pressed });
}

describe('DialogPrompter', () => {
  it('answers s for Sim and n for Não', async () => {
    expect(await new DialogPrompter(new FakeWindow(0).show).ask('Executar? [s/N] ')).toBe('s');
    expect(await new DialogPrompter(new FakeWindow(1).show).ask('Executar? [s/N] ')).toBe('n');
  });

  it('shows the question without the terminal hint, with Não as the default and as the way out', async () => {
    const window = new FakeWindow(1);
    await new DialogPrompter(window.show).ask('O agente quer apagar "Tese".\nExecutar? [s/N] ');
    expect(window.shown[0]).toMatchObject({
      message: 'O agente quer apagar "Tese".\nExecutar?',
      buttons: ['Sim', 'Não'],
      defaultId: 1,
      cancelId: 1,
    });
  });
});
