export type AISkill = 'metadata' | 'summary' | 'extraction' | 'embeddings';
export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'ollama_cloud' | 'llama_cpp';

export interface AIModelConfig {
  id: number;
  skill: AISkill;
  provider: AIProvider;
  model_name: string;
  updated_at: string;
}

export type VenueCategory = 'conference' | 'journal' | 'workshop' | 'symposium' | 'other';
export type MilestoneFieldType = 'single' | 'range';
export type MilestoneStatus = 'pending' | 'completed';

export interface ScientificMilestone {
  id?: number;
  venue_id?: number;
  label: string;
  field_type: MilestoneFieldType;
  target_date: string;
  end_date?: string;
  has_time: boolean;
  target_time?: string;
  status: MilestoneStatus;
}

export interface ScientificVenue {
  id: number;
  title: string;
  acronym?: string;
  category: VenueCategory;
  url?: string;
  color?: string;
  created_at?: string;
  milestones: ScientificMilestone[];
}

export interface Project {
  id: number;
  name: string;
  created_at: string;
  last_executed_at?: string;
  stats?: ProjectStats;
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
  csl_json?: unknown;
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
  position?: number;
  category?: string;
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
  content_text?: string;
  id: string; // The UI uses string id for highlight
  article_id: number;
  color: string;
  position_data: unknown; // Coordinate data for the highlighter
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
  DIALOG_SAVE_FILE = 'dialog:saveFile',
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
  AI_MODEL_CONFIG_GET_ALL = 'aiModelConfig:getAll',
  AI_MODEL_CONFIG_UPDATE = 'aiModelConfig:update',
  AI_MODEL_CONFIG_RESTORE = 'aiModelConfig:restore',
  PENDING_HIGHLIGHTS_GET = 'pendingHighlights:get',
  PENDING_HIGHLIGHTS_DELETE = 'pendingHighlights:delete',
  PROJECT_DOCUMENTS_GET = 'projectDocuments:get',
  PROJECT_DOCUMENTS_CREATE = 'projectDocuments:create',
  PROJECT_DOCUMENTS_UPDATE = 'projectDocuments:update',
  PROJECT_DOCUMENTS_REORDER = 'projectDocuments:reorder',
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
  BACKUP_LIST_AUTO = 'backup:listAuto',
  BACKUP_RESTORE_AUTO = 'backup:restoreAuto',
  QUESTION_SETS_LIST = 'questionSets:list',
  QUESTION_SETS_GET = 'questionSets:get',
  QUESTION_SETS_CREATE = 'questionSets:create',
  QUESTION_SETS_UPDATE = 'questionSets:update',
  QUESTION_SETS_DELETE = 'questionSets:delete',
  QUESTION_SETS_DUPLICATE = 'questionSets:duplicate',
  INVESTIGATION_RESULTS_SAVE = 'investigationResults:save',
  INVESTIGATION_RESULTS_GET = 'investigationResults:get',
  INVESTIGATION_RESULTS_GET_BY_ARTICLE = 'investigationResults:getByArticle',
  PDF_LIBRARY_LIST = 'pdfLibrary:list',
  PDF_LIBRARY_DELETE = 'pdfLibrary:delete',
  PDF_LIBRARY_LINK = 'pdfLibrary:link',
  PDF_LIBRARY_UPLOAD = 'pdfLibrary:upload',
  ARTICLES_IMPORT_FROM_PROJECT = 'articles:importFromProject',
  SCIENTIFIC_VENUES_GET_ALL = 'scientificVenues:getAll',
  SCIENTIFIC_VENUE_CREATE = 'scientificVenue:create',
  SCIENTIFIC_VENUE_UPDATE = 'scientificVenue:update',
  SCIENTIFIC_VENUE_DELETE = 'scientificVenue:delete',
  SCIENTIFIC_MILESTONE_TOGGLE_STATUS = 'scientificMilestone:toggleStatus',
}

export interface CategoryOption {
  id?: number;
  name: string;
}

export interface ProjectCategory {
  id: number;
  project_id: number;
  name: string;
  type: string; // e.g. 'text', 'boolean', 'enum', 'multiselect'
  options?: string; // Legacy comma-separated options
  parsedOptions?: CategoryOption[]; // Relational array of options
}

export interface ArticleCategory {
  category_id: number;
  name: string;
  type: string;
  value?: string;
  option_ids?: number[];
  option_names?: string[];
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

export interface QuestionSet {
  id: number;
  project_id: number | null;
  name: string;
  description: string | null;
  questions: string; // JSON string array
  created_at: string;
  updated_at: string;
}

export interface InvestigationResult {
  id: number;
  investigation_id: number;
  article_id: number;
  question: string;
  answer: string | null;
  quote: string | null;
  status: 'success' | 'error' | 'skipped';
  error_message: string | null;
  created_at: string;
}

export type TabId = 'overview' | 'articles' | 'ai' | 'history' | 'diaries';

export interface TrashItem {
  id: number;
  title?: string;
  content?: string;
  name?: string;
  type: 'project' | 'article' | 'annotation';
  deleted_at: string;
}

export interface SearchHistoryItem {
  id: number;
  unified_query: string;
  translated_queries: string;
  total_results: number;
  results_breakdown: string;
  created_at: string;
  sort_by?: string;
  limit_val?: number;
}

export interface SearchHistoryRecord {
  query: string;
  count: number;
  error?: string;
  timestamp: string;
}

export interface AIExtractionResult {
  article: Article;
  result: Record<string, unknown>;
}

export interface ProjectStats {
  active: number;
  read: number;
  archived: number;
  total: number;
  withPdf: number;
  diaryDates: string[];
}
export interface RAGExtractionResult {
  question: string;
  synthesizedAnswer: string;
  confidenceScore: number;
  evidences: Array<{
    text: string;
    page: number;
    bbox: { x: number; y: number; w: number; h: number } | null;
    reasoning: string;
    score?: number;
  }>;
}
