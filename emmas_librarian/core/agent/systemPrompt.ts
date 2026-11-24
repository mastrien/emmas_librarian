import { systemContext, type FocusProject } from '../harness/systemContext';

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
export function systemPromptFor(input: { today: Date; focusProject?: FocusProject; routed?: boolean }): string {
  const routing = input.routed ? `\n\n${ROUTING}` : '';
  return `${INSTRUCTIONS}${routing}\n\n${systemContext(input)}`;
}

/** Added when the model starts with a single tool, select_areas, and receives the others by subject. */
const ROUTING = [
  'Você começa só com a ferramenta select_areas. Antes de agir, chame select_areas com os assuntos do pedido:',
  'só então recebe as ferramentas deles. Um pedido pode ter mais de um assunto; pode chamar select_areas de novo para somar.',
].join('\n');
