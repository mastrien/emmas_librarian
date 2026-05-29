import Cite from 'citation-js';
import abntCsl from '../assets/csl/abnt.csl?raw';
import ptBrLocale from '../assets/csl/locales-pt-BR.xml?raw';

// Register ABNT templates and pt-BR locale
Cite.plugins.config.get('@csl').templates.add('abnt', abntCsl);
Cite.plugins.config.get('@csl').locales.add('pt-BR', ptBrLocale);

export type CitationStyle = 'abnt' | 'apa' | 'vancouver' | 'harvard1' | 'ieee';

export function generateCitation(article: any, style: CitationStyle = 'abnt'): string {
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

    if (article.doi) {
      data.DOI = article.doi.trim();
    }

    // Try to use csl_json if present
    const finalData = article.csl_json ? JSON.parse(article.csl_json) : data;

    const cite = new Cite(finalData);
    return cite.format('bibliography', {
      format: 'text',
      template: style,
      lang: style === 'abnt' ? 'pt-BR' : 'en-US'
    }).trim();
  } catch (error) {
    console.error('Error generating citation:', error);
    return `[Erro ao gerar citação: ${article.title}]`;
  }
}
