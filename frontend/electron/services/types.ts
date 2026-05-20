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
  source_databases: string[];
  csl_json: any;
}
