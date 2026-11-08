import type { Article } from '../../../types';

/** What the article forms edit, as typed (strings, untrimmed). */
export interface ArticleFormFields {
  title: string;
  authors: string;
  year: string;
  doi: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  abstract: string;
}

export const EMPTY_ARTICLE_FIELDS: ArticleFormFields = {
  title: '',
  authors: '',
  year: '',
  doi: '',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  abstract: '',
};

/** Metadata to start or fill a form from: an article, or what the AI extracted (its year may come as text). */
export type ArticleFormSource = Partial<Record<keyof ArticleFormFields, string | number | null>>;

/** Said when the title is only spaces: the field's `required` lets those through. */
export const TITLE_REQUIRED = 'O título é obrigatório.';

/**
 * The form's starting values for an existing article (missing ones empty).
 *
 * @example fieldsFromArticle(article).year // '2021'
 */
export function fieldsFromArticle(article: ArticleFormSource): ArticleFormFields {
  const text = (key: keyof ArticleFormFields) => (article[key] ? String(article[key]) : '');
  return {
    title: text('title'),
    authors: text('authors'),
    year: text('year'),
    doi: text('doi'),
    journal: text('journal'),
    volume: text('volume'),
    issue: text('issue'),
    pages: text('pages'),
    abstract: text('abstract'),
  };
}

const optional = (value: string): string | undefined => value.trim() || undefined;

/**
 * What the form saves: trimmed text, the year as a number, and undefined for each empty optional field.
 *
 * @example articleFromForm({ ...EMPTY_ARTICLE_FIELDS, title: ' Radar ', year: '2021' }) // { title: 'Radar', year: 2021, … }
 */
export function articleFromForm(fields: ArticleFormFields): Partial<Article> {
  return {
    title: fields.title.trim(),
    authors: fields.authors.trim(),
    year: fields.year.trim() ? parseInt(fields.year.trim(), 10) : undefined,
    doi: optional(fields.doi),
    journal: optional(fields.journal),
    volume: optional(fields.volume),
    issue: optional(fields.issue),
    pages: optional(fields.pages),
    abstract: optional(fields.abstract),
  };
}

/**
 * "Preencher com IA": the extracted metadata fills only the fields the person left empty; what they typed stays.
 *
 * @example fillEmptyFields({ ...fields, title: 'Meu título' }, { title: 'IA', year: 2020 }) // title kept, year '2020'
 */
export function fillEmptyFields(fields: ArticleFormFields, extracted: ArticleFormSource): ArticleFormFields {
  const found = fieldsFromArticle(extracted);
  const next = { ...fields };
  for (const key of Object.keys(next) as (keyof ArticleFormFields)[]) {
    if (!next[key].trim() && found[key]) next[key] = found[key];
  }
  return next;
}
