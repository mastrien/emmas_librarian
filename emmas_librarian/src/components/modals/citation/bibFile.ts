/** Where the downloaded BibTeX is offered to be saved. */
export const BIB_FILE_NAME = 'referencias.bib';

/**
 * The references as the content of a .bib file: one entry after the other, a blank line between them.
 *
 * @example bibFileContent(['@article{a}', '@article{b}']); // '@article{a}\n\n@article{b}\n'
 */
export const bibFileContent = (entries: string[]): string => entries.join('\n\n') + '\n';
