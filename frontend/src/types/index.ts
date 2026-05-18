export interface Highlight {
  id: string;
  artigo_id: number;
  color: string;
  position_data: any; // Coordinate data for the highlighter
  annotation_id?: number;
  comment?: string; // Content of the linked annotation
}

export interface Annotation {
  id: number;
  artigo_id: number;
  conteudo_markdown: string;
  data_criacao: string;
}

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
  base_origem: string[];
  csl_json: any;
  status: 'novo' | 'lido' | 'arquivado';
}
