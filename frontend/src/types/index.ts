export interface QueryBlock {
  id: string;
  field: 'title' | 'year';
  value: string;
  type: 'contains' | 'equals' | 'greater_than' | 'less_than';
}

export interface Project {
  id: number;
  name: string;
  data_criacao: string;
  ultima_execucao?: string;
}

export interface Article {
  id: number;
  projeto_id: number;
  doi?: string;
  titulo: string;
  autores?: string;
  ano?: number;
  query_origem: string;
  base_origem: string[]; // Normalized from JSON in backend
  csl_json: any;
  status: 'novo' | 'lido' | 'arquivado';
}
