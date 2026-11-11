/** The version of the app in which these terms were last changed (shown as "Atualizado na versão …", board 174). */
export const TERMS_VERSION = '1.3.1';

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
];
