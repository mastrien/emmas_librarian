import { describe, it, expect } from 'vitest';
import { BIB_FILE_NAME, bibFileContent } from '../bibFile';

describe('bibFileContent', () => {
  it('separates the entries with a blank line and ends with a newline', () => {
    expect(bibFileContent(['@article{a}', '@article{b}'])).toBe('@article{a}\n\n@article{b}\n');
  });

  it('is a single newline for no entries', () => {
    expect(bibFileContent([])).toBe('\n');
  });

  it('offers the file as a .bib', () => {
    expect(BIB_FILE_NAME.endsWith('.bib')).toBe(true);
  });
});
