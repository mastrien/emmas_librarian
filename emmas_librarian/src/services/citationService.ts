import Cite from 'citation-js';
import abntCsl from '../assets/csl/abnt.csl?raw';
import ptBrLocale from '../assets/csl/locales-pt-BR.xml?raw';

// Register ABNT templates and pt-BR locale
Cite.plugins.config.get('@csl').templates.add('abnt', abntCsl);
Cite.plugins.config.get('@csl').locales.add('pt-BR', ptBrLocale);

export type CitationStyle = 'abnt' | 'apa' | 'vancouver' | 'harvard1' | 'ieee';

export type CitationOutputFormat = 'text' | 'html' | 'bibtex';

export function generateCitation(article: any, style: CitationStyle = 'abnt', format: CitationOutputFormat = 'text'): string {
  try {
    const data: any = {
      id: article.id,
      type: 'article-journal', // Default to journal article
      title: article.title,
    };

    if (article.authors) {
      data.author = article.authors.split(';').map((authorStr: string) => {
        const parts = authorStr.trim().split(/\s+/);
        if (parts.length > 1) {
          return { family: parts.pop(), given: parts.join(' ') };
        }
        return { literal: authorStr.trim() };
      });
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

    return cite.format('bibliography', {
      format: format === 'html' ? 'html' : 'text',
      template: style,
      lang: style === 'abnt' ? 'pt-BR' : 'en-US'
    }).trim();
  } catch (error) {
    console.error('Error generating citation:', error);
    return `[Erro ao gerar citação: ${article.title}]`;
  }
}
