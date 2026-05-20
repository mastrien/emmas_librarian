export interface Project {
  id: number;
  name: string;
  created_at: string;
  last_executed_at?: string;
}

export interface Article {
  id: number;
  project_id: number;
  doi?: string;
  title: string;
  authors?: string;
  year?: number;
  source_query: string;
  source_databases: string;
  csl_json: string | any;
  local_file_path?: string;
  status: 'new' | 'read' | 'archived';
  archive_note?: string;
}

export interface Annotation {
  id: number;
  article_id: number;
  content_markdown: string;
  created_at: string;
}

export interface Highlight {
  id: string; // The UI uses string id for highlight
  article_id: number;
  color: string;
  position_data: any; // Coordinate data for the highlighter
  annotation_id?: number;
  comment?: string; // Content of the linked annotation
}

export type QueryField = 'all' | 'title' | 'abstract' | 'authors';
export type QueryOperator = 'contains' | 'exact' | 'not_contains';
export type QuerySort = 'relevance' | 'citations' | 'date';

export interface QueryRuleNode {
  type: 'rule';
  field: QueryField;
  operator: QueryOperator;
  value: string;
}

export interface QueryGroupNode {
  type: 'group';
  logicalOperator: 'AND' | 'OR';
  children: QueryASTNode[];
}

export type QueryASTNode = QueryRuleNode | QueryGroupNode;

export interface QueryTranslationResult {
  query: string;
  isValid: boolean;
  error?: string;
  warning?: string;
}

export interface DatabaseTranslationMap {
  [dbId: string]: QueryTranslationResult;
}

export enum IpcChannel {
  PROJECTS_GET_ALL = 'projects:getAll',
  PROJECTS_CREATE = 'projects:create',
  PROJECTS_GET_ONE = 'projects:getOne',
  PROJECTS_UPDATE = 'projects:update',
  PROJECTS_DELETE = 'projects:delete',
  PROJECTS_GET_SEARCH_HISTORY = 'projects:getSearchHistory',
  SEARCH_EXECUTE = 'search:execute',
  SEARCH_TRANSLATE_QUERY = 'search:translateQuery',
  ARTICLES_GET_BY_PROJECT = 'articles:getByProject',
  ARTICLES_GET_ONE = 'articles:getOne',
  ARTICLES_UPDATE_STATUS = 'articles:updateStatus',
  HIGHLIGHTS_GET = 'highlights:get',
  HIGHLIGHTS_CREATE = 'highlights:create',
  HIGHLIGHTS_DELETE = 'highlights:delete',
  ANNOTATIONS_GET = 'annotations:get',
  ANNOTATIONS_CREATE = 'annotations:create',
  ANNOTATIONS_UPDATE = 'annotations:update',
  ANNOTATIONS_DELETE = 'annotations:delete',
  PDF_UPLOAD = 'pdf:upload',
  PDF_GET = 'pdf:get',
  EXPORT_CSV = 'export:csv',
  DIALOG_OPEN_FILE = 'dialog:openFile',
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',
}
