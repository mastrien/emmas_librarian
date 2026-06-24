import { describe, it, expect } from 'vitest';
import { generateCitation, parseAuthors } from '../citationService';

describe('citationService', () => {
  it('should generate ABNT citation for a basic article', () => {
    const article = {
      id: 1,
      title: 'Testing Citation Formatting',
      authors: 'John Doe; Jane Smith',
      year: 2021,
    } as unknown as import('../../types').Article;

    const cite = generateCitation(article, 'abnt');
    expect(cite).toContain('DOE, John; SMITH, Jane');
    expect(cite).toContain('Testing Citation Formatting');
    expect(cite).toContain('2021');
  });

  it('should fallback gracefully if data is missing', () => {
    const article = { id: 2, title: 'No Data Article' } as unknown as import('../../types').Article;
    const cite = generateCitation(article, 'apa');
    expect(cite).toContain('No Data Article');
  });

  it('should generate citation with pages field from the database', () => {
    const article = {
      id: 3,
      title: 'Article with Pages Field',
      authors: 'Alice Johnson',
      year: 2022,
      pages: '45-67',
    } as unknown as import('../../types').Article;
    const cite = generateCitation(article, 'abnt');
    expect(cite).toContain('45');
    expect(cite).toContain('67');
  });

  it('should parse comma-separated authors and apply et al. truncation appropriately', () => {
    const article = {
      id: 4,
      title: 'Testing Multi Author Comma Separated',
      authors: 'John Doe, Jane Smith, Robert Smith, Mary Williams',
      year: 2021,
    } as unknown as import('../../types').Article;

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
      year: 2021,
    } as unknown as import('../../types').Article;

    const citeWithEtAl = generateCitation(article, 'abnt', 'text', true);
    expect(citeWithEtAl).toContain('DOE, John et al.');
    expect(citeWithEtAl).not.toContain('SMITH, Jane');

    const citeWithoutEtAl = generateCitation(article, 'abnt', 'text', false);
    expect(citeWithoutEtAl).toContain('DOE, John');
    expect(citeWithoutEtAl).toContain('SMITH, Jane');
    expect(citeWithoutEtAl).toContain('SMITH, Robert');
    expect(citeWithoutEtAl).toContain('WILLIAMS, Mary');
  });

  it('should merge data with csl_json correctly if present', () => {
    const article = {
      id: 6,
      title: 'Explicit Title',
      authors: 'John Doe',
      year: 2023,
      csl_json: JSON.stringify({
        title: 'Original Title',
        publisher: 'CSL Publisher',
        volume: '12',
      }),
    } as unknown as import('../../types').Article;

    const cite = generateCitation(article, 'apa');
    expect(cite).toContain('Explicit Title');
  });

  it('should format using IEEE style', () => {
    const article = {
      id: 7,
      title: 'IEEE Format Article',
      authors: 'John Doe',
      year: 2024,
    } as unknown as import('../../types').Article;

    const cite = generateCitation(article, 'ieee');
    expect(cite).toContain('IEEE Format Article');
  });

  it('should handle invalid csl_json gracefully by ignoring it', () => {
    const article = {
      id: 8,
      title: 'Broken CSL JSON',
      authors: 'Jane Smith',
      year: 2023,
      csl_json: '{broken-json}',
    } as unknown as import('../../types').Article;

    const cite = generateCitation(article, 'apa');
    expect(cite).toContain('Broken CSL JSON');
  });

  it('should return fallback string when citation formatting throws an error', () => {
    const cite = generateCitation(null as any, 'apa');
    expect(cite).toContain('[Erro ao gerar citação: artigo inválido]');
  });
});

describe('parseAuthors', () => {
  it('extracts family name when author is in "Given Family" format (semicolon list)', () => {
    const result = parseAuthors('João Silva; Maria Souza');
    expect(result[0]).toEqual({ family: 'Silva', given: 'João' });
    expect(result[1]).toEqual({ family: 'Souza', given: 'Maria' });
  });

  it('extracts family name when author is in "Family, Given" format', () => {
    const result = parseAuthors('Silva, João');
    expect(result[0]).toEqual({ family: 'Silva', given: 'João' });
  });

  it('extracts family from multi-word given name "Given Middle Family"', () => {
    const result = parseAuthors('Mary Jane Watson');
    expect(result[0]).toEqual({ family: 'Watson', given: 'Mary Jane' });
  });

  it('returns literal for single-word author (no family/given split possible)', () => {
    const result = parseAuthors('Platão');
    expect(result[0]).toEqual({ literal: 'Platão' });
  });

  it('returns empty array for empty string', () => {
    expect(parseAuthors('')).toEqual([]);
  });

  it('parses mixed semicolon list with "Family, Given" entries', () => {
    const result = parseAuthors('Smith, John; Doe, Jane');
    expect(result[0]).toEqual({ family: 'Smith', given: 'John' });
    expect(result[1]).toEqual({ family: 'Doe', given: 'Jane' });
  });

  it('handles single author with no comma as "Given Family"', () => {
    const result = parseAuthors('Ana Paula Oliveira');
    expect(result[0]).toEqual({ family: 'Oliveira', given: 'Ana Paula' });
  });

  it('handles exactly two comma-separated full names as two authors', () => {
    // "João Silva, Maria Souza" — both parts have spaces → two authors
    const result = parseAuthors('João Silva, Maria Souza');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ family: 'Silva', given: 'João' });
    expect(result[1]).toEqual({ family: 'Souza', given: 'Maria' });
  });
});
