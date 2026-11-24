import type { DecisionModel, DecisionReply, DecisionRequest } from '../../../agent/systemOne';

/** A decision model that answers with prepared probabilities for the subject, or fails, and remembers what it was asked. */
export class FakeDecisionModel implements DecisionModel {
  readonly asked: DecisionRequest[] = [];

  constructor(private readonly outcome: Record<string, number> | Error) {}

  async decide(request: DecisionRequest): Promise<DecisionReply> {
    this.asked.push(request);
    if (this.outcome instanceof Error) throw this.outcome;
    const [best] = Object.entries(this.outcome).sort((a, b) => b[1] - a[1]);
    const answer = { type: 'choice' as const, choice: best[0], probabilities: this.outcome, confidence: best[1] };
    return { answers: { assunto: answer }, inputTokens: 50, wallMs: 3 };
  }
}
