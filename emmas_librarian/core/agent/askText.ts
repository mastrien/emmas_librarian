import type { AskResult } from './ask';

const SHOWN_ARGUMENT_CHARS = 120;

function callLine(call: AskResult['calls'][number]): string {
  const args =
    call.arguments.length > SHOWN_ARGUMENT_CHARS ? `${call.arguments.slice(0, SHOWN_ARGUMENT_CHARS)}…` : call.arguments;
  return `- ${call.tool}(${args}) ${call.ok ? 'ok' : `recusada ou com erro: ${call.error}`}`;
}

/**
 * The answer for a person: the text, and below it every call the agent made, so they can check what it did. A small model
 * is wrong about one request in eight; the list is how they find out.
 *
 * Usage:
 *   askAsText({ answer: 'Você tem 1 projeto.', calls: [...], ... });
 */
export function askAsText(result: AskResult): string {
  const lines = [result.answer.trim() || '(sem resposta)'];
  if (result.stopped === 'max-steps') lines.push('', 'Parei no limite de passos sem uma resposta final.');
  if (result.calls.length > 0) lines.push('', 'Chamadas feitas:', ...result.calls.map(callLine));
  return lines.join('\n');
}
