# Visão 4 — Componentes do Frontend (React Pages & Components)

> Hierarquia de páginas e componentes React, mostrando composição e roteamento.

## Árvore de Roteamento e Composição

```mermaid
flowchart TB
    subgraph EntryPoint["main.tsx (Entry)"]
        HashRouter["HashRouter"]
    end

    subgraph LayoutWrap["Layout.tsx (Wrapper Global)"]
        Sidebar["Sidebar\n(Navegação)"]
        Logo["Logo.tsx"]
        HelpBtn["HelpButton.tsx"]
    end

    subgraph Pages["Pages (Lazy-loaded via React.lazy)"]
        Dashboard["DashboardPage\n/ (raiz)"]
        NewProject["NewProjectPage\n/new-project"]
        ProjectDetails["ProjectDetailsPage\n/projects/:id"]
        Search["SearchPage\n/projects/:id/search"]
        ArticleReader["ArticleReaderPage\n/articles/:id"]
        Settings["SettingsPage\n/settings"]
        Terms["TermsOfUsePage\n/terms"]
    end

    subgraph DashboardComponents["Componentes do Dashboard"]
        DashCal["DashboardCalendar"]
        Changelog["ChangelogModal"]
    end

    subgraph ProjectComponents["Componentes do ProjectDetails"]
        ArtTable["ArticleTable"]
        CatCell["CategoryCell"]
        QB["QueryBuilder"]
        SearchHist["SearchHistoryModal"]
        SearchSumm["SearchSummaryModal"]
        ManualArt["ManualArticleModal"]
        EditArt["EditArticleModal"]
        AIExtract["AIExtractionModal"]
        QuotaMod["QuotaModal"]
        ArchiveMod["ArchiveModal"]
        CitMod["CitationModal"]
        DiaryComp["DiarySection"]
        QAModal["ManageQuickAccessModal"]
        ProjCat["ProjectCategoriesModal"]
    end

    subgraph FrontendServices["Serviços do Frontend"]
        ApiTS["services/api.ts\n(projectService)"]
        CitSvc["services/citationService.ts"]
    end

    HashRouter --> LayoutWrap
    LayoutWrap --> Pages

    Dashboard --> DashboardComponents
    ProjectDetails --> ProjectComponents
    Search --> QB

    Pages --> ApiTS
    ProjectComponents --> ApiTS
    DashboardComponents --> ApiTS
    ArticleReader --> ApiTS
    CitMod --> CitSvc

    style EntryPoint fill:#f3e8ff,stroke:#9333ea,stroke-width:2px
    style LayoutWrap fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
    style Pages fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    style ProjectComponents fill:#dcfce7,stroke:#22c55e,stroke-width:2px
    style DashboardComponents fill:#fce7f3,stroke:#ec4899,stroke-width:2px
    style FrontendServices fill:#fee2e2,stroke:#ef4444,stroke-width:2px
```

## Resumo

| Página | Rota | Componentes Principais |
|---|---|---|
| DashboardPage | `/` | DashboardCalendar, ChangelogModal |
| NewProjectPage | `/new-project` | Formulário simples |
| ProjectDetailsPage | `/projects/:id` | ArticleTable, QueryBuilder, 10+ modais |
| SearchPage | `/projects/:id/search` | QueryBuilder |
| ArticleReaderPage | `/articles/:id` | PdfHighlighter (react-pdf-highlighter), anotações inline |
| SettingsPage | `/settings` | Configurações de API keys, tema, versão |
| TermsOfUsePage | `/terms` | Conteúdo estático |

### Padrão de comunicação

Todos os componentes que precisam de dados usam `projectService` de `api.ts`, que encapsula chamadas `window.electronAPI.invoke()` em Promises tipadas.
