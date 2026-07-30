# Visão 7 — Caso de Uso: Busca em Bases SEM Chave de API (OpenAlex, Crossref)

> Diagrama de sequência do fluxo de busca nas bases abertas que não exigem autenticação.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant SP as SearchPage
    participant QB as QueryBuilder
    participant API as api.ts (projectService)
    participant PRE as preload.ts
    participant IPC as handlers.ts
    participant SO as SearchOrchestrator
    participant QT as QueryTranslator
    participant AI_OA as ApiIntegrator (OpenAlex)
    participant AI_CR as ApiIntegrator (Crossref)
    participant DB as DatabaseManager
    participant ExtOA as 🌐 api.openalex.org
    participant ExtCR as 🌐 api.crossref.org

    User->>QB: Constrói árvore booleana visual (AND/OR/NOT)
    User->>SP: Clica em "Buscar"

    SP->>API: projectService.translateQuery(ast)
    API->>PRE: invoke('search:translateQuery', ast)
    PRE->>IPC: ipcMain → queryTranslator.translate(ast)
    IPC->>QT: translate(ast)
    QT-->>IPC: { openalex: {query, isValid}, crossref: {query, isValid}, ... }
    IPC-->>API: DatabaseTranslationMap
    API-->>SP: queryMap com queries traduzidas

    SP->>SP: Exibe preview das queries por base
    User->>SP: Confirma execução

    SP->>API: projectService.searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery)
    API->>PRE: invoke('search:execute', ...)
    PRE->>IPC: ipcMain handle
    IPC->>SO: searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery)

    Note over SO: Verifica quais bases estão no queryMap

    par Buscas paralelas (Promise.all)
        SO->>AI_OA: searchOpenAlex(filterStr, sortBy, limit)
        AI_OA->>ExtOA: GET /works?filter=...&per_page=...&sort=...
        ExtOA-->>AI_OA: JSON { results: [...] }
        AI_OA->>AI_OA: normalizeOpenAlex() para cada item
        AI_OA-->>SO: NormalizedArticle[]
    and
        SO->>AI_CR: searchCrossref(queryStr, sortBy, limit)
        AI_CR->>ExtCR: GET /works?query.title=...&rows=...
        ExtCR-->>AI_CR: JSON { message: { items: [...] } }
        AI_CR->>AI_CR: normalizeCrossref() para cada item
        AI_CR-->>SO: NormalizedArticle[]
    end

    SO->>SO: deduplicate() por DOI e título normalizado
    SO->>DB: saveSearchHistory(projectId, unifiedQuery, queryMap, count, breakdown)
    
    loop Para cada artigo deduplicado
        SO->>DB: saveArticle(projectId, articleData)
    end

    SO->>DB: getArticlesByProject(projectId)
    DB-->>SO: Article[]
    SO-->>IPC: { savedCount, articles, breakdown }
    IPC-->>API: resultado
    API-->>SP: { savedCount, breakdown }

    SP->>SP: Exibe SearchSummaryModal com breakdown por base
```

## Pontos-Chave

- **OpenAlex** e **Crossref** não requerem autenticação
- As buscas são **paralelas** via `Promise.all`
- Cada base tem seu próprio método de normalização (`normalizeOpenAlex`, `normalizeCrossref`)
- A **deduplicação** é feita por DOI (exato) e título (case-insensitive, trimmed)
- O **histórico** de busca é registrado antes da persistência dos artigos
