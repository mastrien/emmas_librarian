import type { AskCitation, AskCitationAccess, AskReadCitation, AskStep, AskUnverified } from '../../types';

const LABEL_LENGTH = 28;

const shortTitle = (title: string): string =>
  title.length <= LABEL_LENGTH ? title : `${title.slice(0, LABEL_LENGTH - 1).trimEnd()}…`;

// "Almeida, R.; Tavares, C." and "Almeida R, Tavares C" both start with the surname.
const firstSurname = (authors: string | null): string | null => authors?.split(/[,;]/)[0].trim().split(' ')[0] || null;

/**
 * How a citation reads on its button.
 *
 * @example citationLabel({ authors: 'Almeida, R.', year: 2021, page: 4, title: 'x' }) // 'Almeida 2021, p. 4'
 */
export function citationLabel(citation: Pick<AskCitation, 'authors' | 'year' | 'page' | 'title'>): string {
  const surname = firstSurname(citation.authors);
  const source = surname ? [surname, citation.year].filter(Boolean).join(' ') : shortTitle(citation.title);
  return `${source}, p. ${citation.page}`;
}

/**
 * Why a statement is marked, in words that ask the person to check it.
 *
 * @example unverifiedReason({ kind: 'no_source' })
 */
export function unverifiedReason(unverified: AskUnverified): string {
  if (unverified.kind === 'no_source') return 'A IA não indicou de onde tirou isto. Confira antes de usar.';
  if (unverified.kind === 'loose_text') {
    return 'A IA respondeu fora do formato combinado, sem dizer de onde tirou cada ponto. Confira antes de usar.';
  }
  const names = unverified.sources.join(', ');
  return `A IA citou ${names}, mas só ${unverified.available} trechos foram lidos. Confira antes de usar.`;
}

/**
 * The note beside a citation, when it cannot simply be opened where it was read. A deleted project is not the end of
 * the PDF, so each case says only what is known.
 *
 * @example citationAccessNote({ ...citation, access: { kind: 'trash' } })
 */
export function citationAccessNote(citation: AskCitation & { access: AskCitationAccess }): string | null {
  const { access } = citation;
  if (access.kind === 'trash') {
    return 'Este artigo está na lixeira. Restaure-o para abrir o PDF; o trecho abaixo foi guardado com a resposta.';
  }
  if (access.kind === 'gone') {
    return 'O artigo e o PDF não estão mais na biblioteca. O trecho abaixo foi guardado com a resposta.';
  }
  return access.articleId === citation.articleId
    ? null
    : 'O artigo original saiu do projeto. Abre pela cópia em outro projeto, que usa o mesmo PDF.';
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * What the answer did before writing. It is its own line so that, when the AI can use other functions of the app, each
 * of them becomes one more line like this.
 *
 * @example stepText({ kind: 'search', chunks: 20, articles: 12, projects: ['A', 'B'] })
 */
export function stepText(step: AskStep): string {
  const read = `${plural(step.chunks, 'trecho', 'trechos')} de ${plural(step.articles, 'artigo', 'artigos')}`;
  return `Buscou nos PDFs de ${plural(step.projects.length, 'projeto', 'projetos')}: ${read}`;
}

/**
 * The notice over an answer with marked statements.
 *
 * @example auditNotice(2) // '2 pontos desta resposta não puderam ser conferidos.'
 */
export function auditNotice(count: number): string {
  return count === 1
    ? '1 ponto desta resposta não pôde ser conferido.'
    : `${count} pontos desta resposta não puderam ser conferidos.`;
}

/**
 * The router state that opens the reader on a citation's page and comes back to the conversation.
 *
 * @example navigate(`/articles/${id}`, { state: citationReaderState(citation, 3) });
 */
export function citationReaderState(citation: AskReadCitation, conversationId: number) {
  return {
    searchQuery: citation.text,
    page: citation.page,
    backTo: { path: `/ask/${conversationId}`, label: 'Voltar à conversa' },
  };
}
