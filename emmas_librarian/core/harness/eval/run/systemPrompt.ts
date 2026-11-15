import { systemContext, type FocusProject } from '../../systemContext';

/** Version of the instructions below: it goes into every run record, so two runs are only compared if it matches. */
export const SYSTEM_PROMPT_VERSION = 'v1';

const INSTRUCTIONS = [
  "Você é o assistente da biblioteca de pesquisa do Emma's Librarian. Use as ferramentas para consultar e alterar a biblioteca.",
  'Regras:',
  '- Nunca invente ids, datas ou nomes: consulte a biblioteca antes de agir sobre algo que a pessoa só citou pelo nome.',
  '- Se nenhuma ferramenta permite o que a pessoa pediu, diga que não tem acesso a isso e não tente outro caminho.',
  '- Alterações precisam da aprovação da pessoa, que o sistema pede por você. Se uma chamada voltar ERR_NOT_CONFIRMED, avise que nada foi feito.',
  '- Se uma chamada voltar um erro, leia a mensagem: corrija os argumentos se o erro for seu; se for da biblioteca, conte à pessoa.',
  '- Responda em português, de forma curta.',
].join('\n');

/**
 * The system prompt of an episode: the instructions, then the date and the project in focus.
 *
 * Usage:
 *   systemPromptFor({ today: new Date(2026, 10, 15), focusProject: { id: 1, name: 'Revisão sobre tutoria' } });
 */
export function systemPromptFor(input: { today: Date; focusProject?: FocusProject }): string {
  return `${INSTRUCTIONS}\n\n${systemContext(input)}`;
}

/** 'YYYY-MM-DD' as a local date; a case names today as text. */
export function dayFromText(text: string | undefined): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '2026-11-15');
  if (!match) throw new Error(`[ERR_INVALID_DAY] Offending value: ${JSON.stringify(text)}. Expected YYYY-MM-DD.`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
