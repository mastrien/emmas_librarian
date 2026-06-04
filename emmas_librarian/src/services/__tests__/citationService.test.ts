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

  it('should generate citation with pages field from the database', () => {
    const article = {
      id: 3,
      title: 'Article with Pages Field',
      authors: 'Alice Johnson',
      year: 2022,
      pages: '45-67'
    };
    const cite = generateCitation(article, 'abnt');
    expect(cite).toContain('45');
    expect(cite).toContain('67');
  });

  it('should parse comma-separated authors and apply et al. truncation appropriately', () => {
    const article = {
      id: 4,
      title: 'Testing Multi Author Comma Separated',
      authors: 'John Doe, Jane Smith, Robert Smith, Mary Williams',
      year: 2021
    };

    // By default, abnt uses et al. for 4 or more authors
    const citeWithEtAl = generateCitation(article, 'abnt', 'text', true);
    expect(citeWithEtAl).toContain('DOE, John et al.');
    expect(citeWithEtAl).not.toContain('SMITH, Jane');

    // With useEtAl = false, it should list all authors
    const citeWithoutEtAl = generateCitation(article, 'abnt', 'text', false);
    expect(citeWithoutEtAl).toContain('DOE, John');
    expect(citeWithoutEtAl).toContain('SMITH, Jane');
    expect(citeWithoutEtAl).toContain('SMITH, Robert');
    expect(citeWithoutEtAl).toContain('WILLIAMS, Mary');
  });

  it('should parse semicolon-separated authors and apply et al. truncation appropriately', () => {
    const article = {
      id: 5,
      title: 'Testing Multi Author Semicolon Separated',
      authors: 'John Doe; Jane Smith; Robert Smith; Mary Williams',
      year: 2021
    };

    const citeWithEtAl = generateCitation(article, 'abnt', 'text', true);
    expect(citeWithEtAl).toContain('DOE, John et al.');
    expect(citeWithEtAl).not.toContain('SMITH, Jane');

    const citeWithoutEtAl = generateCitation(article, 'abnt', 'text', false);
    expect(citeWithoutEtAl).toContain('DOE, John');
    expect(citeWithoutEtAl).toContain('SMITH, Jane');
    expect(citeWithoutEtAl).toContain('SMITH, Robert');
    expect(citeWithoutEtAl).toContain('WILLIAMS, Mary');
  });
});
