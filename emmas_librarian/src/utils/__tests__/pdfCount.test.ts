import { describe, expect, it } from 'vitest';
import { pdfCount } from '../pdfCount';

describe('pdfCount', () => {
  it.each([
    [1, '1 PDF'],
    [2, '2 PDFs'],
    [0, '0 PDFs'],
  ])('says %i as %s', (count, said) => {
    expect(pdfCount(count)).toBe(said);
  });
});
