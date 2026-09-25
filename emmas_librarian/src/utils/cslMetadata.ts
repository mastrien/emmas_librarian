import type { Article } from '../types';

/** The editable citation metadata, all as form strings (year included). */
export interface CitationFields {
  title: string;
  authors: string;
  year: string;
  doi: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
  /** YYYY-MM-DD, as produced by <input type="date">. */
  accessed: string;
}

interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}

interface CslItem {
  title?: string;
  author?: CslName[];
  issued?: { 'date-parts'?: (number | string)[][] };
  DOI?: string;
  'container-title'?: string;
  volume?: string | number;
  issue?: string | number;
  page?: string;
  // Non-standard spelling; CitationModal used to read only this one, so both are accepted.
  pages?: string;
  URL?: string;
}

/**
 * Form values for an article's saved metadata, with missing fields as ''.
 *
 * Usage:
 *   setFields(citationFieldsFromArticle(article));
 */
export function citationFieldsFromArticle(article: Article): CitationFields {
  return {
    title: article.title || '',
    authors: article.authors || '',
    year: article.year?.toString() || '',
    doi: article.doi || '',
    journal: article.journal || '',
    volume: article.volume || '',
    issue: article.issue || '',
    pages: article.pages || '',
    url: article.url || '',
    accessed: article.accessed || '',
  };
}

const formatCslName = (name: CslName) =>
  name.family && name.given ? `${name.given} ${name.family}` : name.literal || name.family || name.given || '';

const cslAuthors = (csl: CslItem) =>
  Array.isArray(csl.author) ? csl.author.map(formatCslName).filter(Boolean).join('; ') : '';

const cslYear = (csl: CslItem) => csl.issued?.['date-parts']?.[0]?.[0]?.toString() || '';

/**
 * Form values rebuilt from an article's original CSL-JSON (string or parsed object).
 * `accessed` is always '' because CSL records carry no access date for us.
 * Throws a SyntaxError when given a malformed JSON string.
 *
 * Usage:
 *   setFields(citationFieldsFromCsl(article.csl_json));
 */
export function citationFieldsFromCsl(cslJson: unknown): CitationFields {
  const csl: CslItem = typeof cslJson === 'string' ? JSON.parse(cslJson) : (cslJson as CslItem);
  return {
    title: csl.title || '',
    authors: cslAuthors(csl),
    year: cslYear(csl),
    doi: csl.DOI || '',
    journal: csl['container-title'] || '',
    volume: csl.volume?.toString() || '',
    issue: csl.issue?.toString() || '',
    pages: csl.page || csl.pages || '',
    url: csl.URL || '',
    accessed: '',
  };
}

/**
 * The payload for `updateArticleMetadata`: form strings with the year made numeric (or dropped when blank).
 *
 * Usage:
 *   await projectService.updateArticleMetadata(article.id, citationFieldsToMetadata(fields));
 */
export function citationFieldsToMetadata(fields: CitationFields): Partial<Article> {
  return { ...fields, year: fields.year ? Number(fields.year) : undefined };
}

/** An article whose citation fields hold the form strings, as passed to `generateCitation` while editing. */
export type CitableArticle = Omit<Article, keyof CitationFields> & CitationFields;

/**
 * The article with its citation fields normalized to form strings.
 *
 * Usage:
 *   const citable = articles.map(toCitableArticle);
 */
export function toCitableArticle(article: Article): CitableArticle {
  return { ...article, ...citationFieldsFromArticle(article) };
}

const CITATION_FIELD_NAMES: ReadonlyArray<keyof CitationFields> = [
  'title',
  'authors',
  'year',
  'doi',
  'journal',
  'volume',
  'issue',
  'pages',
  'url',
  'accessed',
];

/**
 * Just the citation fields of a larger object, e.g. a CitableArticle opened for editing.
 *
 * Usage:
 *   const fields = pickCitationFields(citableArticle);
 */
export function pickCitationFields(source: CitationFields): CitationFields {
  return Object.fromEntries(CITATION_FIELD_NAMES.map((name) => [name, source[name]])) as unknown as CitationFields;
}

/**
 * Like `citationFieldsFromCsl`, but null when there is no CSL-JSON or it cannot be parsed,
 * so "Resetar" can fall back to the saved values.
 *
 * Usage:
 *   setFields(tryCitationFieldsFromCsl(article.csl_json) ?? citationFieldsFromArticle(article));
 */
export function tryCitationFieldsFromCsl(cslJson: unknown): CitationFields | null {
  if (!cslJson) return null;
  try {
    return citationFieldsFromCsl(cslJson);
  } catch (err) {
    console.error('Failed to parse csl_json for reset', err);
    return null;
  }
}
