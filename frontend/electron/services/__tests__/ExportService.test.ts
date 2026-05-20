import { describe, it, expect } from 'vitest';
import { ExportService } from '../ExportService';
import { Article } from '../../types';

describe('ExportService', () => {
  const exportService = new ExportService();

  const mockArticles: Article[] = [
    {
      id: 1,
      project_id: 1,
      source_query: '',
      csl_json: '',
      title: 'A Beautiful Paper on AI',
      authors: 'Doe, John; Smith, Jane J.; Silva AB',
      year: 2024,
      doi: 'https://doi.org/10.1000/xyz123',
      source_databases: 'OpenAlex',
      status: 'new',
      journal: 'Journal of Future AI',
      volume: '42',
      issue: '3',
      pages: '150-165',
      citation_count: 10,
      affiliations: 'AI Institute, Brazil',
      abstract: 'This is a "beautiful" abstract with \n newlines and \r carriage returns.',
      author_keywords: 'AI; ML; Deep Learning',
      index_keywords: 'Artificial Intelligence; Machine Learning',
      references_list: 'Ref 1; Ref 2',
      issn: '1234-5678',
      document_type: 'Article'
    },
    {
      id: 2,
      project_id: 1,
      source_query: '',
      csl_json: '',
      title: 'Another Simple Paper',
      authors: 'OnlyAuthor',
      year: 2023,
      doi: '10.1111/xyz456',
      source_databases: 'Scopus',
      status: 'read',
      journal: 'Simple Journal',
      volume: '1',
      issue: '',
      pages: '45',
      citation_count: 0,
      affiliations: '',
      abstract: 'Simple abstract.',
      author_keywords: '',
      index_keywords: '',
      references_list: '',
      issn: '',
      document_type: ''
    }
  ];

  describe('exportToCsv', () => {
    it('correctly exports a list of articles as standard CSV content', () => {
      const csv = exportService.exportToCsv(mockArticles);
      
      const lines = csv.split('\n');
      expect(lines.length).toBe(3); // Header + 2 data rows
      
      // Check headers
      expect(lines[0]).toBe('id,doi,title,authors,year,source,status');
      
      // Check row 1
      const row1 = lines[1];
      expect(row1).toContain('1');
      expect(row1).toContain('https://doi.org/10.1000/xyz123');
      expect(row1).toContain('"A Beautiful Paper on AI"');
      expect(row1).toContain('"Doe, John; Smith, Jane J.; Silva AB"');
      expect(row1).toContain('2024');
      expect(row1).toContain('"OpenAlex"');
      expect(row1).toContain('new');
      
      // Check row 2
      const row2 = lines[2];
      expect(row2).toContain('2');
      expect(row2).toContain('10.1111/xyz456');
      expect(row2).toContain('"Another Simple Paper"');
      expect(row2).toContain('"OnlyAuthor"');
      expect(row2).toContain('2023');
      expect(row2).toContain('"Scopus"');
      expect(row2).toContain('read');
    });

    it('handles empty articles list gracefully', () => {
      const csv = exportService.exportToCsv([]);
      expect(csv).toBe('id,doi,title,authors,year,source,status');
    });

    it('escapes double quotes in CSV fields', () => {
      const articles: Article[] = [
        {
          id: 3,
          project_id: 1,
          source_query: '',
          csl_json: '',
          title: 'Paper with "Quotes"',
          authors: 'Doe, "Johnny"',
          year: 2022,
          doi: '',
          source_databases: 'WoS, "Scopus"',
          status: 'new'
        }
      ];
      
      const csv = exportService.exportToCsv(articles);
      const lines = csv.split('\n');
      const dataRow = lines[1];
      
      expect(dataRow).toContain('"Paper with ""Quotes"""');
      expect(dataRow).toContain('"Doe, ""Johnny"""');
      expect(dataRow).toContain('"WoS, ""Scopus"""');
    });
  });

  describe('exportToBiblioshiny', () => {
    it('starts with a UTF-8 BOM and contains exactly 45 columns in header and data rows', () => {
      const csv = exportService.exportToBiblioshiny(mockArticles);
      
      // Verify BOM
      expect(csv.startsWith('\uFEFF')).toBe(true);
      
      // Strip BOM for further checks
      const cleanCsv = csv.slice(1);
      const lines = cleanCsv.split('\r\n');
      expect(lines.length).toBe(3); // Header + 2 data rows

      // Helper function to split CSV row respecting double quotes
      const parseCsvRow = (row: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            if (inQuotes && row[i + 1] === '"') {
              current += '"';
              i++; // skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current);
        return result;
      };

      const headerCols = parseCsvRow(lines[0]);
      expect(headerCols.length).toBe(45);
      expect(headerCols[0]).toBe('Authors');
      expect(headerCols[3]).toBe('Title');
      expect(headerCols[44]).toBe('EID');

      const row1Cols = parseCsvRow(lines[1]);
      expect(row1Cols.length).toBe(45);

      // Verify Row 1 properties
      // Authors formatted (abbreviated): Doe, John -> Doe J.; Smith, Jane J. -> Smith JJ.; Silva AB -> Silva AB.
      expect(row1Cols[0]).toBe('Doe J.; Smith JJ.; Silva AB.');
      // Author full names: Doe, John; Smith, Jane J.; Silva, A B
      expect(row1Cols[1]).toBe('Doe, John; Smith, Jane J.; Silva, A B');
      expect(row1Cols[3]).toBe('A Beautiful Paper on AI');
      expect(row1Cols[4]).toBe('2024');
      expect(row1Cols[5]).toBe('Journal of Future AI');
      expect(row1Cols[6]).toBe('42');
      expect(row1Cols[7]).toBe('3');
      expect(row1Cols[9]).toBe('150'); // Page start
      expect(row1Cols[10]).toBe('165'); // Page end
      expect(row1Cols[11]).toBe('10'); // Cited by
      expect(row1Cols[12]).toBe('10.1000/xyz123'); // Cleaned DOI
      expect(row1Cols[13]).toBe('https://doi.org/10.1000/xyz123'); // Link
      expect(row1Cols[14]).toBe('AI Institute, Brazil'); // Affiliations
      // Authors with affiliations
      expect(row1Cols[15]).toBe('Doe J., AI Institute, Brazil; Smith JJ., AI Institute, Brazil; Silva AB., AI Institute, Brazil');
      // Abstract handles escaping and normalizes whitespace
      expect(row1Cols[16]).toBe('This is a "beautiful" abstract with   newlines and   carriage returns.');
      expect(row1Cols[17]).toBe('AI; ML; Deep Learning');
      expect(row1Cols[18]).toBe('Artificial Intelligence; Machine Learning');
      expect(row1Cols[25]).toBe('Ref 1; Ref 2');
      expect(row1Cols[34]).toBe('1234-5678');
      expect(row1Cols[38]).toBe('English');
      expect(row1Cols[40]).toBe('Article');
      expect(row1Cols[41]).toBe('Final');
      expect(row1Cols[43]).toBe('Scopus');
      expect(row1Cols[44]).toBe('2-s2.0-1'); // EID

      const row2Cols = parseCsvRow(lines[2]);
      expect(row2Cols.length).toBe(45);
      expect(row2Cols[0]).toBe('OnlyAuthor'); // Single author formatting
      expect(row2Cols[1]).toBe('OnlyAuthor'); // Full name
      expect(row2Cols[9]).toBe('45'); // Page start from single page
      expect(row2Cols[10]).toBe(''); // Page end empty
      expect(row2Cols[11]).toBe('0'); // Cited by 0
      expect(row2Cols[12]).toBe('10.1111/xyz456');
      expect(row2Cols[14]).toBe(''); // Affiliations empty
      expect(row2Cols[15]).toBe(''); // Authors with affiliations empty
      expect(row2Cols[40]).toBe('Article'); // Fallback document type
      expect(row2Cols[44]).toBe('2-s2.0-2'); // EID
    });
  });

  describe('Private/Helper logic via public flows', () => {
    it('handles various author structures in formatAuthors', () => {
      // Test author format details through a single article export to Biblioshiny
      const runAuthorFormatTest = (authors: string) => {
        const testArt: Article = {
          id: 99,
          project_id: 1,
          source_query: '',
          csl_json: '',
          title: 'Test Authors',
          authors,
          year: 2026,
          source_databases: 'Scopus',
          status: 'new'
        };
        const csv = exportService.exportToBiblioshiny([testArt]);
        const cleanLines = csv.slice(1).split('\r\n');
        // Column index 0: Authors (abbreviated), 1: Author full names
        const parts = cleanLines[1].split('","').map(s => s.replace(/"/g, ''));
        return {
          abbreviated: parts[0],
          full: parts[1]
        };
      };

      // 1. Empty authors
      const resEmpty = runAuthorFormatTest('');
      expect(resEmpty.abbreviated).toBe('');
      expect(resEmpty.full).toBe('');

      // 2. Author with comma and whitespace (no semicolon in whole string => splits on comma)
      const resComma = runAuthorFormatTest('  Mendes ,  Emma ');
      expect(resComma.abbreviated).toBe('Mendes; Emma');
      expect(resComma.full).toBe('Mendes; Emma');

      // 2b. Single author with comma and semicolon (semicolon present => splits on semicolon, preserving single author)
      const resSingleAuthorWithSemi = runAuthorFormatTest('  Mendes ,  Emma ;');
      expect(resSingleAuthorWithSemi.abbreviated).toBe('Mendes E.');
      expect(resSingleAuthorWithSemi.full).toBe('Mendes, Emma');

      // 3. Multi-word author with no comma (e.g. John Albert Smith)
      const resMultiWord = runAuthorFormatTest('John Albert Smith');
      expect(resMultiWord.abbreviated).toBe('Smith JA.');
      expect(resMultiWord.full).toBe('Smith, John Albert');

      // 4. Author with initials already capitalized
      const resCapInit = runAuthorFormatTest('Mendes E');
      expect(resCapInit.abbreviated).toBe('Mendes E.');
      expect(resCapInit.full).toBe('Mendes, E');

      // 5. Mixed delimiters (comma/semicolon/comma separated lists)
      const resMixed = runAuthorFormatTest('Silva, A.B.; Santos, C. D.');
      expect(resMixed.abbreviated).toBe('Silva A.; Santos CD.');
      expect(resMixed.full).toBe('Silva, A.B.; Santos, C. D.');
    });

    it('correctly handles various page formats', () => {
      const checkPages = (pages: string | undefined) => {
        const testArt: Article = {
          id: 99,
          project_id: 1,
          source_query: '',
          csl_json: '',
          title: 'Test Pages',
          authors: 'Author',
          year: 2026,
          source_databases: 'Scopus',
          status: 'new',
          pages
        };
        const csv = exportService.exportToBiblioshiny([testArt]);
        const cleanLines = csv.slice(1).split('\r\n');
        // Let's grab column indices 9 (pageStart) and 10 (pageEnd)
        // Header contains EID at index 44. Since we have strings, we split on comma and handle quotes.
        const row = cleanLines[1];
        // Header is: "Authors","Author full names",...,"Page start","Page end",...
        // Let's do a simple split and check contents of the page fields
        expect(row).toContain(pages ? `"${pages.split('-')[0] || ''}"` : '""');
        if (pages && pages.includes('-')) {
          expect(row).toContain(`"${pages.split('-')[1]}"`);
        }
      };

      checkPages('10-20');
      checkPages('450');
      checkPages('');
      checkPages(undefined);
    });

    it('cleans DOI links correctly', () => {
      const checkDoi = (doi: string | undefined) => {
        const testArt: Article = {
          id: 99,
          project_id: 1,
          source_query: '',
          csl_json: '',
          title: 'Test DOI',
          authors: 'Author',
          year: 2026,
          source_databases: 'Scopus',
          status: 'new',
          doi
        };
        const csv = exportService.exportToBiblioshiny([testArt]);
        const cleanLines = csv.slice(1).split('\r\n');
        const row = cleanLines[1];
        // DOI is column index 12 (0-indexed). E.g., ...,"DOI","Link",...
        if (doi) {
          const expectedClean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
          expect(row).toContain(`"${expectedClean}"`);
          expect(row).toContain(`"https://doi.org/${expectedClean}"`);
        } else {
          expect(row).toContain('"",""'); // empty DOI and empty link
        }
      };

      checkDoi('https://doi.org/10.1016/j.jbi.2023.104444');
      checkDoi('http://dx.doi.org/10.1109/tpami.2021.3123456');
      checkDoi('10.1007/s11276-020-02345-z');
      checkDoi('');
      checkDoi(undefined);
    });
  });
});
