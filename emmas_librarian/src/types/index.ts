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
  abstract?: string;
  author_keywords?: string;
  index_keywords?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  affiliations?: string;
  references_list?: string;
  document_type?: string;
  publisher?: string;
  is_oa?: number;
  issn?: string;
  citation_count?: number;
  source_query?: string;
  source_databases?: string;
  csl_json?: string | any;
  local_file_path?: string;
  url?: string;
  accessed?: string;
  status: 'new' | 'read' | 'archived';
  archive_note?: string;
  search_id?: number;
  ai_summary?: string;
  created_at?: string;
}

export interface ProjectDocument {
  id: number;
  project_id: number;
  title: string;
  url?: string;
  local_file_path?: string;
  created_at: string;
}

export interface DiaryEntry {
  id: number;
  project_id: number;
  entry_date: string;
  content: string;
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
  PROJECTS_GET_WRITING_PAD = 'projects:getWritingPad',
  PROJECTS_UPDATE_WRITING_PAD = 'projects:updateWritingPad',
  SEARCH_EXECUTE = 'search:execute',
  SEARCH_TRANSLATE_QUERY = 'search:translateQuery',
  SEARCH_REVERT = 'search:revert',
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
  PDF_UNLINK = 'pdf:unlink',
  ARTICLES_CREATE_MANUAL = 'articles:createManual',
  EXPORT_CSV = 'export:csv',
  EXPORT_BIBLIOSHINY = 'export:biblioshiny',
  EXPORT_XLSX = 'export:xlsx',
  DIALOG_OPEN_FILE = 'dialog:openFile',
  DIALOG_OPEN_MULTIPLE_FILES = 'dialog:openMultipleFiles',
  ARTICLES_CREATE_FROM_PDFS = 'articles:createFromPdfs',
  ARTICLES_UPDATE_METADATA = 'articles:updateMetadata',
  SETTINGS_GET = 'settings:get',
  SETTINGS_SET = 'settings:set',
  DIARY_GET_ALL = 'diary:getAll',
  DIARY_GET_ONE = 'diary:getOne',
  DIARY_SAVE = 'diary:save',
  DIARY_DELETE = 'diary:delete',
  APP_GET_VERSION = 'app:getVersion',
  AI_GENERATE_SUMMARY = 'ai:generateSummary',
  AI_MASSIVE_EXTRACTION = 'ai:massiveExtraction',
  AI_EXTRACT_METADATA = 'ai:extractMetadata',
  PENDING_HIGHLIGHTS_GET = 'pendingHighlights:get',
  PENDING_HIGHLIGHTS_DELETE = 'pendingHighlights:delete',
  PROJECT_DOCUMENTS_GET = 'projectDocuments:get',
  PROJECT_DOCUMENTS_CREATE = 'projectDocuments:create',
  PROJECT_DOCUMENTS_DELETE = 'projectDocuments:delete',
  PROJECT_DOCUMENT_OPEN_EXTERNAL = 'projectDocument:openExternal',
  MASSIVE_INVESTIGATIONS_GET = 'massiveInvestigations:get',
  MASSIVE_INVESTIGATIONS_SAVE = 'massiveInvestigations:save',
  CATEGORIES_GET_PROJECT = 'categories:getProject',
  CATEGORIES_CREATE_PROJECT = 'categories:createProject',
  CATEGORIES_UPDATE_PROJECT = 'categories:updateProject',
  CATEGORIES_DELETE_PROJECT = 'categories:deleteProject',
  CATEGORIES_GET_ARTICLE = 'categories:getArticle',
  CATEGORIES_SET_ARTICLE = 'categories:setArticle',
  CATEGORIES_GET_ALL_PROJECT_ARTICLE = 'categories:getAllProjectArticle',
  SYNC_EXPORT_PROJECT = 'sync:exportProject',
  SYNC_IMPORT_PROJECT = 'sync:importProject',
  TRASH_GET_ITEMS = 'trash:getItems',
  TRASH_RESTORE_ITEM = 'trash:restoreItem',
  TRASH_PERMANENT_DELETE = 'trash:permanentDelete',
  TRASH_EMPTY = 'trash:empty',
  DIARY_GET_HISTORY = 'diary:getHistory',
  DIARY_RESTORE_VERSION = 'diary:restoreVersion',
  BACKUP_EXPORT = 'backup:export',
  BACKUP_RESTORE_OVERRIDE = 'backup:restoreOverride',
  BACKUP_RESTORE_MERGE = 'backup:restoreMerge',
}

export interface ProjectCategory {
  id: number;
  project_id: number;
  name: string;
  type: string; // e.g. 'text', 'select', 'multiselect', etc.
  options?: string; // Comma-separated options for select/multiselect
}

export interface ArticleCategory {
  category_id: number;
  name: string;
  type: string;
  value: string;
}

export interface PendingHighlight {
  id: number;
  article_id: number;
  quote: string;
  context_before: string | null;
  context_after: string | null;
  comment: string | null;
  created_at: string;
}

export interface MassiveInvestigation {
  id: number;
  project_id: number;
  questions: string; // JSON string array
  articles_ids: string; // JSON string array
  created_at: string;
}


