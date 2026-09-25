import type { CitationStyle } from '../../../services/citationService';

/** Styles offered in every citation style picker, in display order. */
export const CITATION_STYLE_OPTIONS: ReadonlyArray<{ value: CitationStyle; label: string }> = [
  { value: 'abnt', label: 'ABNT' },
  { value: 'apa', label: 'APA' },
  { value: 'vancouver', label: 'Vancouver' },
  { value: 'harvard1', label: 'Harvard' },
  { value: 'ieee', label: 'IEEE' },
];
