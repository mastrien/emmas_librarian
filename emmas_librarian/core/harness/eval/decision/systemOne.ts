/** The question types of llama.cpp's /v1/systemone that the routing uses (the API also has `score`). */
export type DecisionQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string };

export interface DecisionRequest {
  /** The text the decision is about. */
  state: string;
  questions: Record<string, DecisionQuestion>;
}

export type DecisionAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'noul'; noul: number };

export interface DecisionReply {
  answers: Record<string, DecisionAnswer>;
  inputTokens: number;
  wallMs: number;
}

/** A model that decides: it answers closed questions with probabilities and writes no text. */
export interface DecisionModel {
  decide(request: DecisionRequest): Promise<DecisionReply>;
}

const badReply = (value: unknown, why: string): Error =>
  new Error(
    `[ERR_BAD_DECISION_REPLY] Offending value: ${JSON.stringify(value)?.slice(0, 300)}. ${why} Expected { answers: { <name>: { type: "choice"|"noul", ... } }, usage: { input_tokens } }.`,
  );

function answerFrom(name: string, raw: unknown): DecisionAnswer {
  const answer = raw as Record<string, unknown> | null;
  if (answer?.type === 'noul' && typeof answer.noul === 'number') return { type: 'noul', noul: answer.noul };
  if (answer?.type === 'choice' && typeof answer.choice === 'string' && answer.probabilities)
    return {
      type: 'choice',
      choice: answer.choice,
      probabilities: answer.probabilities as Record<string, number>,
      confidence: Number(answer.confidence ?? 0),
    };
  throw badReply(raw, `The answer "${name}" is not a choice or a noul.`);
}

/**
 * The reply of /v1/systemone as typed answers.
 *
 * Usage:
 *   parseDecisionReply({ answers: { angry: { type: 'noul', noul: 0.82 } }, usage: { input_tokens: 130 } }, 12);
 */
export function parseDecisionReply(wire: unknown, wallMs: number): DecisionReply {
  const body = wire as { answers?: Record<string, unknown>; usage?: { input_tokens?: number } } | null;
  if (!body?.answers || typeof body.answers !== 'object') throw badReply(wire, 'There is no "answers".');
  const answers = Object.fromEntries(Object.entries(body.answers).map(([name, raw]) => [name, answerFrom(name, raw)]));
  return { answers, inputTokens: body.usage?.input_tokens ?? 0, wallMs };
}

/**
 * A decision model served by llama-server.
 *
 * Usage:
 *   const model = new SystemOneClient('http://127.0.0.1:8090');
 *   const reply = await model.decide({ state: 'Quais projetos eu tenho?', questions });
 */
export class SystemOneClient implements DecisionModel {
  constructor(private readonly baseUrl: string) {}

  async decide(request: DecisionRequest): Promise<DecisionReply> {
    const started = Date.now();
    const response = await fetch(`${this.baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok)
      throw new Error(
        `[ERR_DECISION_HTTP] llama-server answered ${response.status}: ${(await response.text()).slice(0, 300)}. Expected 200.`,
      );
    return parseDecisionReply(await response.json(), Date.now() - started);
  }
}
