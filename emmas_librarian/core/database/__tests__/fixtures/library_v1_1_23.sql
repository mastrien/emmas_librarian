-- Library written by the v1.1.23 data layer (git tag v1.1.23), dumped as SQL. Do not edit by hand:
-- regenerate as described in README.md next to this file.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
, writing_pad TEXT);
INSERT INTO "projects" VALUES(1,'Revisão sistemática','2026-10-03T23:19:23.593Z',NULL,NULL,'# Rascunho');
CREATE TABLE articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    doi TEXT,
    title TEXT NOT NULL,
    authors TEXT,
    year INTEGER,
    source_query TEXT,
    source_databases TEXT,
    csl_json TEXT,
    local_file_path TEXT,
    status TEXT DEFAULT 'new',
    archive_note TEXT,
    is_oa INTEGER,
    publisher TEXT,
    url TEXT,
    accessed TEXT,
    deleted_at DATETIME DEFAULT NULL, abstract TEXT, author_keywords TEXT, index_keywords TEXT, journal TEXT, volume TEXT, issue TEXT, pages TEXT, affiliations TEXT, references_list TEXT, document_type TEXT, issn TEXT, citation_count INTEGER, search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL, ai_summary TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "articles" VALUES(1,1,'10.1000/a','Artigo aberto','Silva, A.',2024,'q','["scopus"]','{"title":"Artigo aberto","is_oa":true,"publisher":"Editora A"}',NULL,'read',NULL,1,'Editora A',NULL,NULL,NULL,'Resumo',NULL,NULL,'Revista',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL);
INSERT INTO "articles" VALUES(2,1,'10.1000/b','Artigo com ''aspas''',NULL,NULL,'q','["scopus"]','{}',NULL,'archived','fora do escopo',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
CREATE TABLE annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    highlight_id INTEGER,
    content_markdown TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    FOREIGN KEY(article_id) REFERENCES articles(id),
    FOREIGN KEY(highlight_id) REFERENCES highlights(id)
);
INSERT INTO "annotations" VALUES(1,1,NULL,'## Nota
com acento: ção','2026-10-03 23:19:23',NULL);
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
INSERT INTO "settings" VALUES('backfilled_is_oa_publisher','true');
INSERT INTO "settings" VALUES('backfilled_category_options','true');
INSERT INTO "settings" VALUES('migrated_vec_dimensions_v3','true');
INSERT INTO "settings" VALUES('backfilled_pdf_files','true');
INSERT INTO "settings" VALUES('theme','dark');
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    unified_query TEXT NOT NULL,
    translated_queries TEXT NOT NULL,
    total_results INTEGER DEFAULT 0,
    results_breakdown TEXT NOT NULL,
    sort_by TEXT,
    limit_val INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "search_history" VALUES(1,1,'TITLE("machine learning")','{"scopus":"TITLE(\"machine learning\")"}',2,'{"scopus":2}',NULL,NULL,'2026-10-03T23:19:23.593Z');
CREATE TABLE highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    color TEXT NOT NULL,
    position_data TEXT NOT NULL,
    content_text TEXT,
    annotation_id INTEGER,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE SET NULL
);
INSERT INTO "highlights" VALUES(1,1,'yellow','{"page":1,"rects":[]}','trecho destacado',1);
CREATE TABLE project_diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, entry_date)
);
INSERT INTO "project_diary" VALUES(1,1,'2026-06-01','Primeiro dia');
CREATE TABLE pending_highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    quote TEXT NOT NULL,
    context_before TEXT,
    context_after TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);
INSERT INTO "pending_highlights" VALUES(1,1,'citação','antes','depois','comentário','2026-10-03 23:19:23');
CREATE TABLE project_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    local_file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    position INTEGER DEFAULT 0,
    category TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "project_documents" VALUES(1,1,'Protocolo','https://example.org/protocolo',NULL,'2026-10-03 23:19:23',0,NULL);
CREATE TABLE question_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE massive_investigations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    questions TEXT NOT NULL,
    articles_ids TEXT NOT NULL,
    model_used TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "massive_investigations" VALUES(1,1,'["Qual o método?"]','[1,2]','modelo','completed','2026-10-03 23:19:23');
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    options TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "project_categories" VALUES(1,1,'Método','enum',NULL);
INSERT INTO "project_categories" VALUES(2,1,'Observação','text',NULL);
CREATE TABLE project_category_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
);
INSERT INTO "project_category_options" VALUES(1,1,'Quantitativo');
INSERT INTO "project_category_options" VALUES(2,1,'Qualitativo');
CREATE TABLE article_categories (
    article_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    value TEXT,
    PRIMARY KEY(article_id, category_id),
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
);
INSERT INTO "article_categories" VALUES(2,2,'revisar depois');
CREATE TABLE article_category_selections (
    article_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    PRIMARY KEY(article_id, category_id, option_id),
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
    FOREIGN KEY(option_id) REFERENCES project_category_options(id) ON DELETE CASCADE
);
INSERT INTO "article_category_selections" VALUES(1,1,1);
CREATE TABLE project_diary_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE investigation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    quote TEXT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(investigation_id) REFERENCES massive_investigations(id) ON DELETE CASCADE,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);
CREATE TABLE ai_model_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "ai_model_config" VALUES(1,'metadata','gemini','gemini-2.5-flash','2026-10-03 23:19:23');
INSERT INTO "ai_model_config" VALUES(2,'summary','gemini','gemini-2.5-flash','2026-10-03 23:19:23');
INSERT INTO "ai_model_config" VALUES(3,'extraction','gemini','gemini-2.5-flash','2026-10-03 23:19:23');
INSERT INTO "ai_model_config" VALUES(4,'embeddings','ollama','nomic-embed-text','2026-10-03 23:19:23');
CREATE TABLE scientific_venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    acronym TEXT,
    category TEXT DEFAULT 'other',
    url TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE scientific_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT DEFAULT 'single',
    target_date TEXT NOT NULL,
    end_date TEXT,
    has_time INTEGER DEFAULT 0,
    target_time TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (venue_id) REFERENCES scientific_venues(id) ON DELETE CASCADE
);
CREATE TABLE pdf_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                text_content TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                bbox_x REAL,
                bbox_y REAL,
                bbox_w REAL,
                bbox_h REAL,
                token_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
            );
CREATE TABLE pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            file_hash TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
INSERT INTO sqlite_sequence(name,seq) VALUES('ai_model_config',4);
INSERT INTO sqlite_sequence(name,seq) VALUES('projects',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('search_history',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('articles',2);
INSERT INTO sqlite_sequence(name,seq) VALUES('annotations',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('highlights',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('pending_highlights',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('massive_investigations',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('project_diary',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('project_documents',1);
INSERT INTO sqlite_sequence(name,seq) VALUES('project_categories',2);
INSERT INTO sqlite_sequence(name,seq) VALUES('project_category_options',2);
CREATE INDEX idx_inv_results_investigation
    ON investigation_results(investigation_id);
CREATE INDEX idx_inv_results_article
    ON investigation_results(article_id);
CREATE INDEX idx_articles_project_id ON articles(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_doi ON articles(doi) WHERE deleted_at IS NULL;
CREATE INDEX idx_articles_local_file_path ON articles(local_file_path);
CREATE INDEX idx_articles_status ON articles(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_annotations_article_id ON annotations(article_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_highlights_article_id ON highlights(article_id);
CREATE INDEX idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX idx_search_history_project_id ON search_history(project_id);
CREATE INDEX idx_project_categories_project_id ON project_categories(project_id);
CREATE INDEX idx_massive_investigations_project_id ON massive_investigations(project_id);
CREATE UNIQUE INDEX idx_project_diary_unique 
        ON project_diary(project_id, entry_date);
COMMIT;
