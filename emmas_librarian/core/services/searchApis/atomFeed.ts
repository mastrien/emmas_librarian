import { DOMParser } from '@xmldom/xmldom';

const ATOM = 'http://www.w3.org/2005/Atom';
const ARXIV = 'http://arxiv.org/schemas/atom';
const OPENSEARCH = 'http://a9.com/-/spec/opensearch/1.1/';

/** One arXiv entry, as read from the Atom feed of the arXiv API. */
export interface ArxivEntry {
  /** The abstract page URL, e.g. http://arxiv.org/abs/2609.32552v1 */
  id: string;
  title: string;
  summary: string;
  published: string;
  authors: { name: string; affiliation?: string }[];
  doi?: string;
  journalRef?: string;
  pdfUrl?: string;
  primaryCategory?: string;
}

export interface ArxivFeed {
  total: number;
  entries: ArxivEntry[];
}

// Minimal DOM surface used here, so this module does not depend on the DOM lib types.
interface XmlElement {
  getElementsByTagNameNS(ns: string, name: string): ArrayLike<XmlElement>;
  getAttribute(name: string): string | null;
  textContent: string | null;
}

const collapse = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

function childText(parent: XmlElement, ns: string, name: string): string | undefined {
  const node = parent.getElementsByTagNameNS(ns, name)[0];
  return node ? collapse(node.textContent) || undefined : undefined;
}

function readAuthors(entry: XmlElement): ArxivEntry['authors'] {
  return Array.from(entry.getElementsByTagNameNS(ATOM, 'author')).map((author) => ({
    name: childText(author, ATOM, 'name') ?? '',
    affiliation: childText(author, ARXIV, 'affiliation'),
  }));
}

function readEntry(entry: XmlElement): ArxivEntry {
  const pdfLink = Array.from(entry.getElementsByTagNameNS(ATOM, 'link')).find((l) => l.getAttribute('title') === 'pdf');
  return {
    id: childText(entry, ATOM, 'id') ?? '',
    title: childText(entry, ATOM, 'title') ?? '',
    summary: childText(entry, ATOM, 'summary') ?? '',
    published: childText(entry, ATOM, 'published') ?? '',
    authors: readAuthors(entry),
    doi: childText(entry, ARXIV, 'doi'),
    journalRef: childText(entry, ARXIV, 'journal_ref'),
    pdfUrl: pdfLink?.getAttribute('href') ?? undefined,
    primaryCategory: entry.getElementsByTagNameNS(ARXIV, 'primary_category')[0]?.getAttribute('term') ?? undefined,
  };
}

/**
 * Reads the Atom feed the arXiv API returns: the total the query matches and its entries. Wraps the XML
 * library so the rest of the app never touches it.
 *
 * Usage:
 *   const { total, entries } = parseArxivFeed(await response.text());
 */
export function parseArxivFeed(xml: string): ArxivFeed {
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as XmlElement;
  const total = Number(childText(doc, OPENSEARCH, 'totalResults') ?? 0);
  return { total, entries: Array.from(doc.getElementsByTagNameNS(ATOM, 'entry')).map(readEntry) };
}
