import type { ConfirmRequest, Confirmer } from '../../confirmer';

/** Answers every request with the same answer and remembers what it was asked. */
export class FakeConfirmer implements Confirmer {
  readonly asked: ConfirmRequest[] = [];

  constructor(private readonly answer: boolean) {}

  async confirm(request: ConfirmRequest): Promise<boolean> {
    this.asked.push(request);
    return this.answer;
  }
}
