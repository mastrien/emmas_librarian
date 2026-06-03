# Visão 11 — Mapa de Canais IPC (IPC Channel Map)

> Catálogo completo de todos os canais IPC registrados, agrupados por domínio funcional.

## Diagrama

```mermaid
flowchart LR
    subgraph Frontend["api.ts (projectService)"]
        direction TB
        F_PROJ["Projetos"]
        F_SEARCH["Busca"]
        F_ART["Artigos"]
        F_PDF["PDF"]
        F_HL["Destaques"]
        F_ANN["Anotações"]
        F_AI["IA"]
        F_EXP["Exportação"]
        F_SET["Configurações"]
        F_DIARY["Diário"]
        F_DOC["Documentos"]
        F_CAT["Categorias"]
        F_INV["Investigações"]
        F_SYNC["Sincronização"]
        F_APP["App"]
    end

    subgraph Channels["IPC Channels"]
        direction TB
        subgraph ChProj["📁 Projetos (8)"]
            C1["projects:getAll"]
            C2["projects:create"]
            C3["projects:getOne"]
            C4["projects:update"]
            C5["projects:delete"]
            C6["projects:getSearchHistory"]
            C7["projects:getWritingPad"]
            C8["projects:updateWritingPad"]
        end
        subgraph ChSearch["🔍 Busca (3)"]
            C9["search:execute"]
            C10["search:translateQuery"]
            C11["search:revert"]
        end
        subgraph ChArt["📄 Artigos (6)"]
            C12["articles:getByProject"]
            C13["articles:getOne"]
            C14["articles:updateStatus"]
            C15["articles:updateMetadata"]
            C16["articles:createManual"]
            C17["articles:createFromPdfs"]
        end
        subgraph ChPdf["📎 PDF (5)"]
            C18["pdf:upload"]
            C19["pdf:get"]
            C20["pdf:unlink"]
            C21["dialog:openFile"]
            C22["dialog:openMultipleFiles"]
        end
        subgraph ChHL["🖍️ Destaques (5)"]
            C23["highlights:get"]
            C24["highlights:create"]
            C25["highlights:delete"]
            C26["pendingHighlights:get"]
            C27["pendingHighlights:delete"]
        end
        subgraph ChAnn["📝 Anotações (4)"]
            C28["annotations:get"]
            C29["annotations:create"]
            C30["annotations:update"]
            C31["annotations:delete"]
        end
        subgraph ChAI["🤖 IA (3)"]
            C32["ai:generateSummary"]
            C33["ai:massiveExtraction"]
            C34["ai:extractMetadata"]
        end
        subgraph ChExp["📊 Exportação (3)"]
            C35["export:csv"]
            C36["export:xlsx"]
            C37["export:biblioshiny"]
        end
        subgraph ChSet["⚙️ Config (3)"]
            C38["settings:get"]
            C39["settings:set"]
            C40["UPDATE_TITLE_BAR"]
        end
        subgraph ChDiary["📓 Diário (4)"]
            C41["diary:getAll"]
            C42["diary:getOne"]
            C43["diary:save"]
            C44["diary:delete"]
        end
        subgraph ChDoc["📌 Documentos (4)"]
            C45["projectDocuments:get"]
            C46["projectDocuments:create"]
            C47["projectDocuments:delete"]
            C48["projectDocument:openExternal"]
        end
        subgraph ChCat["🏷️ Categorias (7)"]
            C49["categories:getProject"]
            C50["categories:createProject"]
            C51["categories:updateProject"]
            C52["categories:deleteProject"]
            C53["categories:getArticle"]
            C54["categories:setArticle"]
            C55["categories:getAllProjectArticle"]
        end
        subgraph ChInv["🔬 Investigações (2)"]
            C56["massiveInvestigations:get"]
            C57["massiveInvestigations:save"]
        end
        subgraph ChSync["🔄 Sync (2)"]
            C58["sync:exportProject"]
            C59["sync:importProject"]
        end
        subgraph ChApp["ℹ️ App (1)"]
            C60["app:getVersion"]
        end
    end

    subgraph Backend["handlers.ts → Serviços"]
        B_DB["DatabaseManager"]
        B_SO["SearchOrchestrator"]
        B_QT["QueryTranslator"]
        B_AI["AIService"]
        B_EXP["ExportService"]
        B_SYNC["SyncService"]
        B_FS["File System"]
        B_APP["Electron app"]
    end

    F_PROJ --> ChProj
    F_SEARCH --> ChSearch
    F_ART --> ChArt
    F_PDF --> ChPdf
    F_HL --> ChHL
    F_ANN --> ChAnn
    F_AI --> ChAI
    F_EXP --> ChExp
    F_SET --> ChSet
    F_DIARY --> ChDiary
    F_DOC --> ChDoc
    F_CAT --> ChCat
    F_INV --> ChInv
    F_SYNC --> ChSync
    F_APP --> ChApp

    ChProj --> B_DB
    ChSearch --> B_SO
    ChSearch --> B_QT
    ChArt --> B_DB
    ChPdf --> B_DB
    ChPdf --> B_FS
    ChHL --> B_DB
    ChAnn --> B_DB
    ChAI --> B_AI
    ChExp --> B_EXP
    ChSet --> B_DB
    ChDiary --> B_DB
    ChDoc --> B_DB
    ChDoc --> B_FS
    ChCat --> B_DB
    ChInv --> B_DB
    ChSync --> B_SYNC
    ChApp --> B_APP

    style Frontend fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style Channels fill:#fef3c7,stroke:#f59e0b,stroke-width:1px
    style Backend fill:#dcfce7,stroke:#22c55e,stroke-width:2px
```

## Resumo Quantitativo

| Domínio | Canais | Serviço Backend |
|---|---|---|
| Projetos | 8 | DatabaseManager |
| Busca | 3 | SearchOrchestrator, QueryTranslator |
| Artigos | 6 | DatabaseManager |
| PDF / Diálogos | 5 | DatabaseManager, File System |
| Destaques | 5 | DatabaseManager |
| Anotações | 4 | DatabaseManager |
| IA | 3 | AIService |
| Exportação | 3 | ExportService |
| Configurações | 3 | DatabaseManager, Electron |
| Diário | 4 | DatabaseManager |
| Documentos | 4 | DatabaseManager, File System |
| Categorias | 7 | DatabaseManager |
| Investigações | 2 | DatabaseManager |
| Sincronização | 2 | SyncService |
| App | 1 | Electron |
| **Total** | **60** | — |
