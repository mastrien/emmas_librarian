export interface QueryBlock {
  id: string;
  field: 'title' | 'year';
  value: string;
  type: 'contains' | 'equals' | 'greater_than' | 'less_than';
}

export interface NormalizedArticle {
  doi?: string;
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  authorKeywords?: string;
  indexKeywords?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  affiliations?: string;
  references?: string;
  documentType?: string;
  issn?: string;
  citationCount?: number;
  source_databases: string[];
  csl_json: any;
}
