# Visão 5 — Modelo de Dados (ER Diagram — SQLite)

> Esquema relacional completo do banco de dados SQLite (`emma.db`), definido em `schema.sql`.

## Diagrama ER

```mermaid
erDiagram
    projects ||--o{ articles : "contém"
    projects ||--o{ search_history : "registra buscas"
    projects ||--o{ project_diary : "entradas de diário"
    projects ||--o{ project_documents : "documentos rápidos"
    projects ||--o{ massive_investigations : "investigações IA"
    projects ||--o{ project_categories : "categorias customizadas"

    articles ||--o{ annotations : "tem anotações"
    articles ||--o{ highlights : "tem destaques"
    articles ||--o{ pending_highlights : "destaques pendentes IA"
    articles ||--o{ article_categories : "classificações"

    highlights |o--o| annotations : "pode ter anotação"
    project_categories ||--o{ article_categories : "define categorias"

    projects {
        int id PK
        text name
        timestamp created_at
        timestamp last_executed_at
    }

    articles {
        int id PK
        int project_id FK
        text doi
        text title
        text authors
        int year
        text source_query
        text source_databases
        text csl_json
        text local_file_path
        text status "new | read | archived"
        text archive_note
    }

    annotations {
        int id PK
        int article_id FK
        int highlight_id FK "opcional"
        text content_markdown
        datetime created_at
    }

    highlights {
        int id PK
        int article_id FK
        text color
        text position_data "JSON"
        text content_text
        int annotation_id FK "opcional"
    }

    search_history {
        int id PK
        int project_id FK
        text unified_query
        text translated_queries "JSON"
        int total_results
        text results_breakdown "JSON"
        datetime created_at
    }

    settings {
        text key PK
        text value
    }

    project_diary {
        int id PK
        int project_id FK
        text entry_date "UNIQUE com project_id"
        text content
    }

    pending_highlights {
        int id PK
        int article_id FK
        text quote
        text context_before
        text context_after
        text comment
        datetime created_at
    }

    project_documents {
        int id PK
        int project_id FK
        text title
        text url
        text local_file_path
        datetime created_at
    }

    massive_investigations {
        int id PK
        int project_id FK
        text questions "JSON array"
        text articles_ids "JSON array"
        text model_used
        text status
        datetime created_at
    }

    project_categories {
        int id PK
        int project_id FK
        text name
        text type "text | select"
        text options "JSON opcional"
    }

    article_categories {
        int article_id PK_FK
        int category_id PK_FK
        text value
    }
```

## Tabelas e Relacionamentos

| Tabela | Registros | Relacionamento Principal |
|---|---|---|
| `projects` | Projetos de pesquisa | Raiz do modelo |
| `articles` | Artigos acadêmicos | Pertence a `projects` |
| `annotations` | Anotações em Markdown | Pertence a `articles`, opcionalmente a `highlights` |
| `highlights` | Destaques visuais no PDF | Pertence a `articles` |
| `search_history` | Histórico de buscas | Pertence a `projects` |
| `settings` | Configurações key-value | Global (sem FK) |
| `project_diary` | Diário de pesquisa | Pertence a `projects` |
| `pending_highlights` | Destaques sugeridos pela IA | Pertence a `articles` |
| `project_documents` | Documentos de acesso rápido | Pertence a `projects` |
| `massive_investigations` | Histórico de extrações IA | Pertence a `projects` |
| `project_categories` | Categorias customizadas do projeto | Pertence a `projects` |
| `article_categories` | Classificação de artigos | Junction table: `articles` ↔ `project_categories` |
