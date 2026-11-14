// "A, B" with one comma is two authors only when both sides look like full names ("Ana Silva, Bruno
// Costa"); "Doe, John" is one author written family-first.
function splitCommaList(authors: string): string[] {
  const parts = authors.split(',');
  if (parts.length !== 2) return parts;
  const [first, second] = parts.map((p) => p.trim());
  return first.includes(' ') && second.includes(' ') ? [first, second] : [authors];
}

/**
 * Individual author names from the `authors` column, which arrives in two formats: ";"-separated
 * ("Silva, A.; Costa, B.", Scopus/manual) or ","-separated full names ("Ana Silva, Bruno Costa", OpenAlex).
 *
 * @example splitAuthorNames('Silva, A.; Costa, B.') // ['Silva, A.', 'Costa, B.']
 */
export function splitAuthorNames(authors?: string | null): string[] {
  if (!authors) return [];
  const raw = authors.includes(';') ? authors.split(';') : authors.includes(',') ? splitCommaList(authors) : [authors];
  return raw.map((name) => name.trim()).filter(Boolean);
}

/**
 * The first authors and how many more, for one line under a title (boards 153 and 164); 'Autores desconhecidos'
 * when there are none.
 *
 * @example shortAuthorList('Silva, A.; Costa, B.; Lima, C.; Rocha, D.') // 'Silva, A.; Costa, B.; Lima, C.; +1'
 */
export function shortAuthorList(authors?: string | null, visible = 3): string {
  const names = splitAuthorNames(authors);
  if (names.length === 0) return 'Autores desconhecidos';
  const hidden = names.length - visible;
  return [...names.slice(0, visible), ...(hidden > 0 ? [`+${hidden}`] : [])].join('; ');
}
