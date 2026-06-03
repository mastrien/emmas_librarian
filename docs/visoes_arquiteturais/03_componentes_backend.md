# Visão 3 — Componentes do Backend (Electron Services)

> Mapa de todos os serviços do processo principal e suas interdependências.

## Diagrama de Dependências

```mermaid
flowchart TB
    subgraph IPC["ipc/handlers.ts\n(Ponto de entrada — registra 60 handlers)"]
        Setup["setupIpcHandlers()"]
    end

    subgraph Services["Serviços de Negócio"]
        SO["SearchOrchestrator\n• searchAndPersist()\n• deduplicate()"]
        QT["QueryTranslator\n• translate(ast) → 4 sintaxes\n• Scopus / WoS / OpenAlex / Crossref"]
        AI_S["ApiIntegrator\n• searchOpenAlex()\n• searchCrossref()\n• searchScopus(apiKey)\n• searchWoS(apiKey)\n• normalize*() por base"]
        AIS["AIService\n• generateSummary()\n• massiveExtraction()\n• extractMetadataFromPdf()\n• extractTextFromPdf()\n• generateCompletion()\n  (OpenAI → Gemini → Ollama)"]
        ES["ExportService\n• exportToCsv()\n• exportToXlsx()\n• exportToBiblioshiny()"]
        SS["SyncService\n• exportProject()\n• importProject()"]
    end

    subgraph Database["Camada de Dados"]
        DM["DatabaseManager\n• CRUD Projects\n• CRUD Articles\n• CRUD Annotations/Highlights\n• Settings, Diary, Categories\n• SearchHistory\n• PendingHighlights\n• MassiveInvestigations\n• ProjectDocuments"]
        Schema[("schema.sql\n11 tabelas")]
    end

    subgraph External["Dependências Externas"]
        BSQ3["better-sqlite3"]
        PDFP["pdf-parse"]
        AXIOS["fetch (Node native)"]
        XLSX_LIB["xlsx"]
        ADMZIP["adm-zip"]
    end

    Setup --> SO
    Setup --> QT
    Setup --> AI_S
    Setup --> AIS
    Setup --> ES
    Setup --> SS
    Setup --> DM

    SO --> QT
    SO --> AI_S
    SO --> DM

    AIS --> DM
    AIS --> PDFP
    AIS --> AXIOS

    ES --> XLSX_LIB

    SS --> DM
    SS --> ADMZIP

    DM --> BSQ3
    DM --> Schema

    AI_S --> AXIOS

    style IPC fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style Services fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style Database fill:#dcfce7,stroke:#22c55e,stroke-width:2px
    style External fill:#fce7f3,stroke:#ec4899,stroke-width:2px
```

## Responsabilidades dos Serviços

| Serviço | Responsabilidade | Dependências Diretas |
|---|---|---|
| **SearchOrchestrator** | Coordena busca multi-base, deduplicação e persistência | QueryTranslator, ApiIntegrator, DatabaseManager |
| **QueryTranslator** | Converte AST visual → sintaxe nativa (4 bases) | Nenhuma |
| **ApiIntegrator** | HTTP para APIs científicas + normalização de resultados | fetch (Node) |
| **AIService** | Extração de texto PDF + chamadas a LLMs + persistência | DatabaseManager, pdf-parse, fetch |
| **ExportService** | Gera CSV/XLSX/Biblioshiny a partir de artigos | xlsx |
| **SyncService** | Exporta/importa projetos como .zip | DatabaseManager, adm-zip |
| **DatabaseManager** | CRUD completo em 11 tabelas SQLite | better-sqlite3 |
