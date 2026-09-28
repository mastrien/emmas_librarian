import { Article, ProjectCategory } from '../../src/types';
import * as xlsx from 'xlsx';

type ExportCategory = Pick<ProjectCategory, 'id' | 'name'>;
// getAllProjectArticleCategories rows carry article_id even though the shared ArticleCategory type omits it.
type ExportCategoryValue = { article_id?: number; category_id: number; value?: string };
type CellValue = string | number;

interface TabularColumn {
  header: string;
  value: (article: Article) => CellValue;
  // CSV only: free-text columns are always quoted, as the first export did; ids/doi/year/status are not.
  quoted: boolean;
}

// archive_note sits right after status: systematic reviews report why each excluded study was archived.
const BASE_COLUMNS: TabularColumn[] = [
  { header: 'id', value: (a) => a.id, quoted: false },
  { header: 'doi', value: (a) => a.doi || '', quoted: false },
  { header: 'title', value: (a) => a.title || '', quoted: true },
  { header: 'authors', value: (a) => a.authors || '', quoted: true },
  { header: 'year', value: (a) => a.year || '', quoted: false },
  { header: 'source', value: (a) => a.source_databases || '', quoted: true },
  { header: 'status', value: (a) => a.status, quoted: false },
  { header: 'archive_note', value: (a) => a.archive_note || '', quoted: true },
];

function tabularColumns(categories: ExportCategory[], values: ExportCategoryValue[]): TabularColumn[] {
  const categoryColumns = categories.map((cat) => ({
    header: cat.name,
    value: (a: Article) => values.find((v) => v.article_id === a.id && v.category_id === cat.id)?.value || '',
    quoted: true,
  }));
  return [...BASE_COLUMNS, ...categoryColumns];
}

// Excel on Windows reads a UTF-8 CSV without a byte order mark as ANSI and garbles accents ("MÃ©todo").
const UTF8_BOM = '﻿';

function quoteCsv(value: CellValue): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export class ExportService {
  /**
   * Formats a list of articles as standard CSV content (UTF-8 with BOM), one column per project category.
   *
   * @example exportService.exportToCsv(articles, categories, values).slice(1).split('\n')[0] // 'id,doi,...,Método'
   */
  public exportToCsv(
    articles: Article[],
    projectCategories: ExportCategory[] = [],
    articleCategories: ExportCategoryValue[] = [],
  ): string {
    const columns = tabularColumns(projectCategories, articleCategories);
    const rows = articles.map((a) =>
      columns.map((col) => (col.quoted ? quoteCsv(col.value(a)) : String(col.value(a)))).join(','),
    );
    return UTF8_BOM + [columns.map((col) => col.header).join(','), ...rows].join('\n');
  }

  /**
   * Generates a Buffer containing the XLSX file data (sheet "Artigos", same columns as the CSV).
   *
   * @example fs.writeFileSync('out.xlsx', exportService.exportToXlsx(articles, categories, values));
   */
  public exportToXlsx(
    articles: Article[],
    projectCategories: ExportCategory[] = [],
    articleCategories: ExportCategoryValue[] = [],
  ): Buffer {
    const columns = tabularColumns(projectCategories, articleCategories);
    const worksheetData = [
      columns.map((col) => col.header),
      ...articles.map((a) => columns.map((col) => col.value(a))),
    ];
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(worksheetData), 'Artigos');
    return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  }

  /**
   * Formats a list of articles as Scopus/Biblioshiny 45-column CSV layout.
   */
  public exportToBiblioshiny(articles: Article[]): string {
    const headers = [
      'Authors', //  1
      'Author full names', //  2
      'Author(s) ID', //  3
      'Title', //  4
      'Year', //  5
      'Source title', //  6
      'Volume', //  7
      'Issue', //  8
      'Art. No.', //  9
      'Page start', // 10
      'Page end', // 11
      'Cited by', // 12
      'DOI', // 13
      'Link', // 14
      'Affiliations', // 15
      'Authors with affiliations', // 16
      'Abstract', // 17
      'Author Keywords', // 18
      'Index Keywords', // 19
      'Molecular Sequence Numbers', // 20
      'Chemicals/CAS', // 21
      'Tradenames', // 22
      'Manufacturers', // 23
      'Funding Details', // 24
      'Funding Texts', // 25
      'References', // 26
      'Correspondence Address', // 27
      'Editors', // 28
      'Publisher', // 29
      'Sponsors', // 30
      'Conference name', // 31
      'Conference date', // 32
      'Conference location', // 33
      'Conference code', // 34
      'ISSN', // 35
      'ISBN', // 36
      'CODEN', // 37
      'PubMed ID', // 38
      'Language of Original Document', // 39
      'Abbreviated Source Title', // 40
      'Document Type', // 41
      'Publication Stage', // 42
      'Open Access', // 43
      'Source', // 44
      'EID', // 45
    ];

    const rows = articles.map((a) => {
      const pageStart = a.pages?.split('-')[0] || '';
      const pageEnd = a.pages?.split('-')[1] || '';
      const cleanedDoi = this.cleanDoi(a.doi || '');
      return [
        this.escCsv(this.formatAuthors(a.authors || '', true)), //  1 Authors
        this.escCsv(this.formatAuthors(a.authors || '', false)), //  2 Author full names
        this.escCsv(''), //  3 Author(s) ID
        this.escCsv(a.title || ''), //  4 Title
        this.escCsv(a.year || ''), //  5 Year
        this.escCsv(a.journal || ''), //  6 Source title
        this.escCsv(a.volume || ''), //  7 Volume
        this.escCsv(a.issue || ''), //  8 Issue
        this.escCsv(''), //  9 Art. No.
        this.escCsv(pageStart), // 10 Page start
        this.escCsv(pageEnd), // 11 Page end
        this.escCsv(a.citation_count ?? ''), // 12 Cited by
        this.escCsv(cleanedDoi), // 13 DOI
        this.escCsv(cleanedDoi ? `https://doi.org/${cleanedDoi}` : ''), // 14 Link
        this.escCsv(a.affiliations || ''), // 15 Affiliations
        this.escCsv(this.getAuthorsWithAffiliations(a.authors || '', a.affiliations || '')), // 16 Authors with affiliations
        this.escCsv(a.abstract || ''), // 17 Abstract
        this.escCsv(a.author_keywords || ''), // 18 Author Keywords
        this.escCsv(a.index_keywords || ''), // 19 Index Keywords
        this.escCsv(''), // 20 Molecular Sequence Numbers
        this.escCsv(''), // 21 Chemicals/CAS
        this.escCsv(''), // 22 Tradenames
        this.escCsv(''), // 23 Manufacturers
        this.escCsv(''), // 24 Funding Details
        this.escCsv(''), // 25 Funding Texts
        this.escCsv(a.references_list || ''), // 26 References
        this.escCsv(''), // 27 Correspondence Address
        this.escCsv(''), // 28 Editors
        this.escCsv(a.publisher || ''), // 29 Publisher
        this.escCsv(''), // 30 Sponsors
        this.escCsv(''), // 31 Conference name
        this.escCsv(''), // 32 Conference date
        this.escCsv(''), // 33 Conference location
        this.escCsv(''), // 34 Conference code
        this.escCsv(a.issn || ''), // 35 ISSN
        this.escCsv(''), // 36 ISBN
        this.escCsv(''), // 37 CODEN
        this.escCsv(''), // 38 PubMed ID
        this.escCsv('English'), // 39 Language of Original Document
        this.escCsv(''), // 40 Abbreviated Source Title
        this.escCsv(a.document_type || 'Article'), // 41 Document Type
        this.escCsv('Final'), // 42 Publication Stage
        this.escCsv(a.is_oa === 1 ? 'All Open Access' : ''), // 43 Open Access
        this.escCsv('Scopus'), // 44 Source
        this.escCsv(`2-s2.0-${a.id}`), // 45 EID
      ].join(',');
    });

    return UTF8_BOM + [headers.map((h) => this.escCsv(h)).join(','), ...rows].join('\r\n');
  }

  // --- Helper Methods ---

  private escCsv(val: unknown): string {
    const str = String(val ?? '')
      .replace(/\r?\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/"/g, '""');
    return `"${str}"`;
  }

  private formatAuthors(authorsStr: string, abbreviate: boolean): string {
    if (!authorsStr) return '';
    const separator = authorsStr.includes(';') ? ';' : ',';
    const names = authorsStr.split(separator);

    const formatted = names
      .map((name) => {
        const trimmed = name.trim();
        if (!trimmed) return '';

        let lastName = '';
        let firstName = '';

        if (trimmed.includes(',')) {
          const commaIdx = trimmed.indexOf(',');
          lastName = trimmed.substring(0, commaIdx).trim();
          firstName = trimmed.substring(commaIdx + 1).trim();
        } else {
          const parts = trimmed.split(/\s+/).filter(Boolean);
          if (parts.length === 0) return '';
          if (parts.length === 1) {
            lastName = parts[0];
            firstName = '';
          } else {
            const lastPart = parts[parts.length - 1];
            const cleanLast = lastPart.replace(/[^a-zA-Z]/g, '');
            if (cleanLast.length > 0 && cleanLast.length <= 2 && lastPart === lastPart.toUpperCase()) {
              lastName = parts.slice(0, parts.length - 1).join(' ');
              firstName = cleanLast.split('').join(' ');
            } else {
              lastName = parts[parts.length - 1];
              firstName = parts.slice(0, parts.length - 1).join(' ');
            }
          }
        }

        if (abbreviate) {
          const initials = firstName
            .split(/[\s-]+/)
            .map((part) =>
              part
                .replace(/[^a-zA-Z]/g, '')
                .trim()
                .charAt(0)
                .toUpperCase(),
            )
            .filter(Boolean)
            .join('');
          return initials ? `${lastName} ${initials}.` : lastName;
        } else {
          return firstName ? `${lastName}, ${firstName}` : lastName;
        }
      })
      .filter(Boolean);

    return formatted.join('; ');
  }

  private getAuthorsWithAffiliations(authorsStr: string, affiliationsStr: string): string {
    if (!authorsStr) return '';
    const formattedAuthors = this.formatAuthors(authorsStr, true);
    if (!affiliationsStr) return '';
    const authorList = formattedAuthors
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    return authorList.map((auth) => `${auth}, ${affiliationsStr}`).join('; ');
  }

  private cleanDoi(doiStr: string): string {
    if (!doiStr) return '';
    return doiStr.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  }
}
