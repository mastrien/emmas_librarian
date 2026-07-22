import Cite from 'citation-js';
import abntCsl from '../assets/csl/abnt.csl?raw';
import ptBrLocale from '../assets/csl/locales-pt-BR.xml?raw';

// Register ABNT templates and pt-BR locale
const cslPlugin = (Cite.plugins.config.get as any)('@csl');
if (cslPlugin) {
  cslPlugin.templates?.add?.('abnt', abntCsl);
  cslPlugin.locales?.add?.('pt-BR', ptBrLocale);
}

export type CitationStyle = 'abnt' | 'apa' | 'vancouver' | 'harvard1' | 'ieee';

export type CitationOutputFormat = 'text' | 'html' | 'bibtex';

export function parseAuthors(authorsStr: string): any[] {
  if (!authorsStr) return [];

  let rawAuthors: string[] = [];
  if (authorsStr.includes(';')) {
    rawAuthors = authorsStr.split(';');
  } else if (authorsStr.includes(',')) {
    const parts = authorsStr.split(',');
    if (parts.length === 2) {
      // Exactly one comma. Could be "Family, Given" (1 author) or "Author A, Author B" (2 authors)
      const part1 = parts[0].trim();
      const part2 = parts[1].trim();
      const part1HasSpace = part1.includes(' ');
      const part2HasSpace = part2.includes(' ');

      if (part1HasSpace && part2HasSpace) {
        rawAuthors = [part1, part2];
      } else {
        rawAuthors = [authorsStr];
      }
    } else {
      rawAuthors = parts;
    }
  } else {
    rawAuthors = [authorsStr];
  }

  return rawAuthors
    .map((authorStr) => {
      authorStr = authorStr.trim();
      if (!authorStr) return null;

      // If the individual author string has a comma, parse as "Family, Given"
      if (authorStr.includes(',')) {
        const parts = authorStr.split(',');
        if (parts.length === 2) {
          return { family: parts[0].trim(), given: parts[1].trim() };
        }
      }

      // Otherwise, parse as "Given Family"
      const parts = authorStr.split(/\s+/);
      if (parts.length > 1) {
        const family = parts.pop();
        const given = parts.join(' ');
        return { family, given };
      }
      return { literal: authorStr };
    })
    .filter(Boolean);
}

export function generateCitation(
  article: any,
  style: CitationStyle = 'abnt',
  format: CitationOutputFormat = 'text',
  useEtAl: boolean = true,
): string {
  try {
    let finalStyle = style;
    if (!useEtAl) {
      const targetStyleName = `${style}-no-etal`;
      const config = (Cite.plugins.config.get as any)('@csl');
      if (config && config.templates) {
        const templates = config.templates;
        const hasTemplate =
          typeof templates.has === 'function' ? templates.has(targetStyleName) : !!templates.get(targetStyleName);
        if (!hasTemplate) {
          const baseXml = templates.get(style);
          if (baseXml) {
            const modifiedXml = baseXml
              .replace(/et-al-min="\d+"/g, 'et-al-min="99"')
              .replace(/et-al-use-first="\d+"/g, 'et-al-use-first="99"')
              .replace(/et-al-subsequent-min="\d+"/g, 'et-al-subsequent-min="99"')
              .replace(/et-al-subsequent-use-first="\d+"/g, 'et-al-subsequent-use-first="99"');
            templates.add(targetStyleName, modifiedXml);
          }
        }
        finalStyle = targetStyleName as any;
      }
    }
    const data: any = {
      id: article.id,
      type: 'article-journal', // Default to journal article
      title: article.title,
    };

    if (article.authors) {
      data.author = parseAuthors(article.authors);
    }

    if (article.year) {
      data.issued = { 'date-parts': [[article.year]] };
    }

    if (article.doi !== undefined) {
      data.DOI = article.doi ? article.doi.trim() : '';
    }

    if (article.journal !== undefined) {
      data['container-title'] = article.journal ? article.journal.trim() : '';
    }

    if (article.volume !== undefined) {
      data.volume = article.volume ? article.volume.trim() : '';
    }

    if (article.issue !== undefined) {
      data.issue = article.issue ? article.issue.trim() : '';
    }

    if (article.page !== undefined) {
      data.page = article.page ? article.page.trim() : '';
    } else if (article.pages !== undefined) {
      data.page = article.pages ? article.pages.trim() : '';
    }

    if (article.url !== undefined) {
      data.URL = article.url ? article.url.trim() : '';
    }

    if (article.accessed) {
      const parts = article.accessed.split('-');
      if (parts.length === 3) {
        data.accessed = { 'date-parts': [[parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])]] };
      }
    } else if (article.accessed === '') {
      data.accessed = undefined;
    }

    // Try to use csl_json if present, merging with our explicit data so manual edits take precedence
    let finalData = data;
    if (article.csl_json) {
      try {
        const cslData = JSON.parse(article.csl_json);
        finalData = { ...cslData, ...data };
      } catch (e) {
        console.error('Failed to parse csl_json', e);
      }
    }

    const cite = new Cite(finalData);

    if (format === 'bibtex') {
      return cite.format('bibtex');
    }

    return cite
      .format('bibliography', {
        format: format === 'html' ? 'html' : 'text',
        template: finalStyle,
        lang: style === 'abnt' ? 'pt-BR' : 'en-US',
      })
      .trim();
  } catch (error: unknown) {
    console.error('Error generating citation:', error);
    return `[Erro ao gerar citação: ${article?.title || 'artigo inválido'}]`;
  }
}
