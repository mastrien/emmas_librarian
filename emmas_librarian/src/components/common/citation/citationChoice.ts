import type { CitationOutputFormat, CitationStyle } from '../../../services/citationService';
import { CITATION_STYLE_OPTIONS } from './citationStyles';

/** What the citation windows' one picker offers (board 177): the styles, then BibTeX, which is a format of its own. */
export type CitationChoice = CitationStyle | 'bibtex';

export const CITATION_CHOICES: ReadonlyArray<{ value: CitationChoice; label: string }> = [
  ...CITATION_STYLE_OPTIONS,
  { value: 'bibtex', label: 'BibTeX' },
];

const STORAGE_KEY = 'emma_citation_choice';
const DEFAULT_CHOICE: CitationChoice = 'abnt';

const isChoice = (value: string | null): value is CitationChoice => CITATION_CHOICES.some((c) => c.value === value);

/**
 * How a choice is rendered: BibTeX is the "bibtex" format; every style is shown as rich text (the clipboard also
 * carries its plain-text version).
 *
 * @example renderingOf('apa'); // { style: 'apa', format: 'html' }
 */
export function renderingOf(choice: CitationChoice): { style: CitationStyle; format: CitationOutputFormat } {
  return choice === 'bibtex' ? { style: 'abnt', format: 'bibtex' } : { style: choice, format: 'html' };
}

/**
 * The format used last, so the window opens on it ("Lembra o último formato"). Storage can be blocked or empty, and
 * then the default is used.
 *
 * @example readRememberedChoice(localStorage); // 'apa'
 */
export function readRememberedChoice(storage: Pick<Storage, 'getItem'> = localStorage): CitationChoice {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return isChoice(saved) ? saved : DEFAULT_CHOICE;
  } catch {
    return DEFAULT_CHOICE;
  }
}

/**
 * Remembers the format for the next time; a storage that refuses is not worth an error.
 *
 * @example rememberChoice('bibtex', localStorage);
 */
export function rememberChoice(choice: CitationChoice, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, choice);
  } catch {
    // Remembering is a convenience only.
  }
}
