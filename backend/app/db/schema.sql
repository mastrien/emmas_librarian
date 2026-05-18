-- schema.sql
-- Emma's Librarian Database Schema

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_execucao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    doi TEXT,
    titulo TEXT NOT NULL,
    autores TEXT,
    ano INTEGER,
    query_origem TEXT,
    base_origem TEXT, -- JSON list
    csl_json TEXT,    -- Raw content
    status TEXT DEFAULT 'novo', -- novo/lido/arquivado
    FOREIGN KEY (projeto_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artigo_id INTEGER NOT NULL,
    conteudo_markdown TEXT NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artigo_id) REFERENCES articles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artigo_id INTEGER NOT NULL,
    color TEXT NOT NULL,
    position_data TEXT NOT NULL, -- JSON string
    annotation_id INTEGER,
    FOREIGN KEY (artigo_id) REFERENCES articles (id) ON DELETE CASCADE,
    FOREIGN KEY (annotation_id) REFERENCES annotations (id) ON DELETE SET NULL
);
