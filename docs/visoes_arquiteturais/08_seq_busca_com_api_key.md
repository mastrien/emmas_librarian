# Visão 8 — Caso de Uso: Busca em Bases COM Chave de API (Scopus, Web of Science)

> Diagrama de sequência do fluxo de busca nas bases que exigem autenticação, destacando as diferenças em relação às bases abertas.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant SP as SearchPage
    participant API as api.ts
    participant PRE as preload.ts
    participant IPC as handlers.ts
    participant SO as SearchOrchestrator
    participant DB as DatabaseManager
    participant AI_SC as ApiIntegrator (Scopus)
    participant AI_WOS as ApiIntegrator (WoS)
    participant ExtSC as 🌐 api.elsevier.com
    participant ExtWOS as 🌐 api.clarivate.com

    User->>SP: Executa busca (mesma query visual)
    SP->>API: searchAndPersist(projectId, queryMap, limit, sortBy, unifiedQuery)
    API->>PRE: invoke('search:execute', ...)
    PRE->>IPC: ipcMain handle
    IPC->>SO: searchAndPersist(...)

    Note over SO: Recupera API keys do banco
    SO->>DB: getSetting('scopus_api_key')
    DB-->>SO: scopusKey (ou '')
    SO->>DB: getSetting('wos_api_key')
    DB-->>SO: wosKey (ou '')

    alt Scopus API Key presente
        par Busca Scopus
            SO->>AI_SC: searchScopus(queryStr, scopusKey, sortBy, limit)
            AI_SC->>ExtSC: GET /content/search/scopus?query=TITLE-ABS-KEY(...)
            Note right of AI_SC: Header: X-ELS-APIKey: scopusKey
            
            alt Sucesso (200)
                ExtSC-->>AI_SC: JSON { search-results: { entry: [...] } }
                AI_SC->>AI_SC: normalizeScopus() para cada item
                AI_SC-->>SO: NormalizedArticle[]
            else Erro 401 (chave inválida)
                ExtSC-->>AI_SC: 401 Unauthorized
                AI_SC-->>SO: throw Error("Chave de API inválida ou expirada")
                SO->>SO: breakdown.scopus = { count: 0, error: msg }
            else Erro 429 (quota excedida)
                ExtSC-->>AI_SC: 429 Too Many Requests
                AI_SC-->>SO: throw Error
                SO->>SO: breakdown.scopus = { count: 0, error: msg }
            end
        end
    else Scopus API Key ausente
        Note over SO: searchScopus retorna [] imediatamente
    end

    alt WoS API Key presente
        par Busca Web of Science
            SO->>AI_WOS: searchWoS(queryStr, wosKey, sortBy, limit)
            AI_WOS->>ExtWOS: GET /api/wos-starter/v1/search?usrQuery=TS=...
            Note right of AI_WOS: Header: X-ApiKey: wosKey
            
            alt Sucesso (200)
                ExtWOS-->>AI_WOS: JSON { hits: [...] }
                AI_WOS->>AI_WOS: normalizeWoS() para cada item
                AI_WOS-->>SO: NormalizedArticle[]
            else Erro 401
                ExtWOS-->>AI_WOS: 401 Unauthorized
                AI_WOS-->>SO: throw Error("Chave de API inválida ou expirada")
            end
        end
    else WoS API Key ausente
        Note over SO: searchWoS retorna [] imediatamente
    end

    SO->>SO: Combina resultados de todas as bases ativas
    SO->>SO: deduplicate() por DOI + título
    SO->>DB: Persiste histórico e artigos
    SO-->>IPC: { savedCount, articles, breakdown }
    IPC-->>API: resultado com status por base
    API-->>SP: Exibe breakdown (✅ sucesso / ❌ erro por base)
```

## Diferenças em Relação à Busca Aberta

| Aspecto | Bases Abertas (OpenAlex, Crossref) | Bases com API Key (Scopus, WoS) |
|---|---|---|
| **Autenticação** | Nenhuma | Header HTTP com API key |
| **Configuração** | Automática | Requer configuração em Settings |
| **Sem chave** | Sempre executa | Retorna `[]` silenciosamente |
| **Tratamento de erro** | Genérico | Específico (401, 429) |
| **Sintaxe de query** | `filter=` / `query.title=` | `TITLE-ABS-KEY()` / `TS=` |
| **Limite por request** | 200 (OA) / 1000 (CR) | 200 (Scopus) / 100 (WoS) |
