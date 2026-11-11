import type {
  AskAnswer,
  AskCitation,
  AskCitationAccess,
  AskConversation,
  AskReadCitation,
  AskStep,
  AskUnverified,
} from '../../types';

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

const sameSource = (a: AskReadCitation, b: AskReadCitation) =>
  a.articleId === b.articleId && a.page === b.page && a.text === b.text;

/**
 * The distinct passages an answer cites, in the order they first appear: the numbers of the chips (board 168) and
 * the list of "Fontes".
 *
 * @example answerSources(answer).length // 3
 */
export function answerSources(answer: AskAnswer<AskReadCitation>): AskReadCitation[] {
  const sources: AskReadCitation[] = [];
  for (const claim of answer.claims) {
    for (const citation of claim.citations) {
      if (!sources.some((known) => sameSource(known, citation))) sources.push(citation);
    }
  }
  return sources;
}

/**
 * The sources of the answer a citation belongs to; just the citation when no answer holds it.
 *
 * @example sourcesOfCitation(conversation, citation) // [citation, …]
 */
export function sourcesOfCitation(conversation: AskConversation | null, citation: AskReadCitation): AskReadCitation[] {
  for (const message of conversation?.messages ?? []) {
    const sources = message.answer ? answerSources(message.answer) : [];
    if (sources.some((known) => sameSource(known, citation))) return sources;
  }
  return [citation];
}

/**
 * The position of a citation among the sources (counted from 1), 0 when it is not one of them.
 *
 * @example sourceNumber(sources, citation) // 2
 */
export function sourceNumber(sources: AskReadCitation[], citation: AskReadCitation): number {
  return sources.findIndex((known) => sameSource(known, citation)) + 1;
}

/**
 * The text "Copiar" puts on the clipboard: the statements, one per paragraph, each followed by its sources as
 * "[Almeida 2021, p. 4]".
 *
 * @example answerAsText(answer) // 'A série tem 60 anos. [Almeida 2021, p. 4]'
 */
export function answerAsText(answer: AskAnswer<AskReadCitation>): string {
  return answer.claims
    .map((claim) => {
      const sources = claim.citations.map((citation) => `[${citationLabel(citation)}]`).join(' ');
      return sources ? `${claim.text} ${sources}` : claim.text;
    })
    .join('\n\n');
}

/**
 * The heading a conversation sits under in the list (board 168): "Hoje", or the month it was last used in (with the
 * year when it is not this one).
 *
 * @example conversationGroup('2026-08-10T10:00:00Z', new Date(2026, 10, 10)) // 'Agosto'
 */
export function conversationGroup(updatedAt: string, now: Date): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return 'Antes';
  if (date.toDateString() === now.toDateString()) return 'Hoje';
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  const name = month[0].toUpperCase() + month.slice(1);
  return date.getFullYear() === now.getFullYear() ? name : `${name} de ${date.getFullYear()}`;
}
