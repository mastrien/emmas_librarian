import { describe, it, expect } from 'vitest';
import { generateCitation } from '../citationService';

describe('citationService', () => {
  it('should generate ABNT citation for a basic article', () => {
    const article = {
      id: 1,
      title: 'Testing Citation Formatting',
      authors: 'John Doe; Jane Smith',
      year: 2021
    };

    const cite = generateCitation(article, 'abnt');
    expect(cite).toContain('DOE, John; SMITH, Jane');
    expect(cite).toContain('Testing Citation Formatting');
    expect(cite).toContain('2021');
  });

  it('should fallback gracefully if data is missing', () => {
    const article = { id: 2, title: 'No Data Article' };
    const cite = generateCitation(article, 'apa');
    expect(cite).toContain('No Data Article');
  });
});
