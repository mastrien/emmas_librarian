-- Library written by the v1.1.11 data layer (git tag v1.1.11), dumped as SQL. Do not edit by hand:
-- regenerate as described in README.md next to this file.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TIMESTAMP
, writing_pad TEXT);
INSERT INTO "projects" VALUES(1,'Revisão sistemática','2026-10-03T23:19:16.288Z',NULL,'# Rascunho');
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
    accessed TEXT, abstract TEXT, author_keywords TEXT, index_keywords TEXT, journal TEXT, volume TEXT, issue TEXT, pages TEXT, affiliations TEXT, references_list TEXT, document_type TEXT, issn TEXT, citation_count INTEGER, search_id INTEGER REFERENCES search_history(id) ON DELETE SET NULL, ai_summary TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "articles" VALUES(1,1,'10.1000/a','Artigo aberto','Silva, A.',2024,'q','["scopus"]','{"title":"Artigo aberto","is_oa":true,"publisher":"Editora A"}',NULL,'read',NULL,1,'Editora A',NULL,NULL,'Resumo',NULL,NULL,'Revista',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL);
INSERT INTO "articles" VALUES(2,1,'10.1000/b','Artigo com ''aspas''',NULL,NULL,'q','["scopus"]','{}',NULL,'archived','fora do escopo',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
CREATE TABLE annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    highlight_id INTEGER,
    content_markdown TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(article_id) REFERENCES articles(id),
    FOREIGN KEY(highlight_id) REFERENCES highlights(id)
);
INSERT INTO "annotations" VALUES(1,1,NULL,'## Nota
com acento: ção','2026-10-03 23:19:16');
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
INSERT INTO "settings" VALUES('backfilled_is_oa_publisher','true');
INSERT INTO "settings" VALUES('theme','dark');
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    unified_query TEXT NOT NULL,
    translated_queries TEXT NOT NULL,
    total_results INTEGER DEFAULT 0,
    results_breakdown TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "search_history" VALUES(1,1,'TITLE("machine learning")','{"scopus":"TITLE(\"machine learning\")"}',2,'{"scopus":2}','2026-10-03T23:19:16.289Z');
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
INSERT INTO "pending_highlights" VALUES(1,1,'citação','antes','depois','comentário','2026-10-03 23:19:16');
CREATE TABLE project_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    local_file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "project_documents" VALUES(1,1,'Protocolo','https://example.org/protocolo',NULL,'2026-10-03 23:19:16');
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
INSERT INTO "massive_investigations" VALUES(1,1,'["Qual o método?"]','[1,2]','modelo','completed','2026-10-03 23:19:16');
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    options TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
INSERT INTO "project_categories" VALUES(1,1,'Método','enum','Quantitativo,Qualitativo');
INSERT INTO "project_categories" VALUES(2,1,'Observação','text',NULL);
CREATE TABLE article_categories (
    article_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    value TEXT,
    PRIMARY KEY(article_id, category_id),
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
);
INSERT INTO "article_categories" VALUES(1,1,'Quantitativo');
INSERT INTO "article_categories" VALUES(2,2,'revisar depois');
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
CREATE UNIQUE INDEX idx_project_diary_unique 
        ON project_diary(project_id, entry_date);
COMMIT;
