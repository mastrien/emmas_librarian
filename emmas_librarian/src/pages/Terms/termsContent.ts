/** The version of the app in which these terms were last changed (shown as "Atualizado na versão …", board 174). */
export const TERMS_VERSION = '1.3.2';

/**
 * The red notice shown in the terms and beside the IEEE key field: the summaries on this page were not reviewed by a
 * lawyer (the author could not afford one yet), and the IEEE terms are the strictest on AI.
 */
export const LEGAL_REVIEW_WARNING =
  'Atenção: estes resumos NÃO foram revistos por um advogado. Eles vêm da leitura dos termos oficiais por quem ' +
  'desenvolveu o app, que não é jurista, e os termos mudam. Confira você mesmo a página oficial de cada base antes de ' +
  'mandar qualquer texto a uma IA.';

/** The extra line beside the IEEE key: its terms forbid feeding the content to AI systems. */
export const IEEE_AI_WARNING =
  'Os termos de uso da API da IEEE proíbem usar o conteúdo para treinar, melhorar ou desenvolver sistemas de IA. ' +
  'Não envie resultados da IEEE Xplore a uma IA sem ter certeza de que a sua licença permite.';

export type PolicyTone = 'free' | 'restricted';

export interface BasePolicy {
  name: string;
  tone: PolicyTone;
  badge: string;
  text: string;
  linkLabel: string;
  href: string;
}

export interface TermsSection {
  id: string;
  /** The entry of "Nesta página". */
  tocLabel: string;
}

export const TERMS_SECTIONS: readonly TermsSection[] = [
  { id: 'local-first', tocLabel: 'Local-first' },
  { id: 'dados-por-base', tocLabel: 'Dados por base' },
  { id: 'ia-e-chaves', tocLabel: 'IA e as suas chaves' },
  { id: 'responsabilidade', tocLabel: 'Responsabilidade' },
];

export const BASE_POLICIES: readonly BasePolicy[] = [
  {
    name: 'OpenAlex',
    tone: 'free',
    badge: 'Livre (CC0)',
    text: 'Os dados podem ser usados para qualquer fim, inclusive com modelos de linguagem.',
    linkLabel: 'Política do OpenAlex',
    href: 'https://openalex.org/about',
  },
  {
    name: 'Crossref',
    tone: 'free',
    badge: 'Metadados livres',
    text: 'Os metadados são abertos. Os PDFs para onde a Crossref aponta seguem os direitos de cada editora.',
    linkLabel: 'Política da Crossref',
    href: 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/',
  },
  {
    name: 'Scopus',
    tone: 'restricted',
    badge: 'Restritivo',
    text: 'Mineração só para fins acadêmicos e não comerciais. Mandar resumos da Scopus para uma IA externa pode violar os termos se a licença da sua instituição não autorizar.',
    linkLabel: 'Política da Elsevier',
    href: 'https://dev.elsevier.com/tecdoc_text_mining.html',
  },
  {
    name: 'Web of Science',
    tone: 'restricted',
    badge: 'Restritivo',
    text: 'A API proíbe usar os dados com IA não autorizada pela Clarivate.',
    linkLabel: 'Termos da Clarivate',
    href: 'https://clarivate.com/terms-of-business/',
  },
  {
    name: 'IEEE Xplore',
    tone: 'restricted',
    badge: 'Muito restritivo',
    text: 'Só uso acadêmico e não comercial. Os termos proíbem usar o conteúdo para treinar, melhorar ou desenvolver sistemas de IA, proíbem a mineração de texto e pedem que o conteúdo não seja mantido depois do fim da licença. Não envie resultados da IEEE a uma IA.',
    linkLabel: 'Termos da API da IEEE',
    href: 'https://developer.ieee.org/API_Terms_of_Use2',
  },
  {
    name: 'arXiv',
    tone: 'free',
    badge: 'Metadados livres (CC0)',
    text: 'Os metadados são CC0. Os artigos (PDFs) são dos autores: você pode guardá-los e usá-los para pesquisa ou uso pessoal, mas não servi-los a outras pessoas. O arXiv pede no máximo uma requisição a cada 3 segundos, e o app respeita isso.',
    linkLabel: 'Termos da API do arXiv',
    href: 'https://info.arxiv.org/help/api/tou.html',
  },
  {
    name: 'Europe PMC',
    tone: 'free',
    badge: 'Leitura livre',
    text: 'A leitura é gratuita, mas o que se pode reutilizar (mineração, tradução) depende da licença de cada artigo, em geral Creative Commons. Você é o responsável por cumprir essa licença.',
    linkLabel: 'Direitos autorais da Europe PMC',
    href: 'https://europepmc.org/Copyright',
  },
];
