# Visão 1 — Visão Geral de Camadas (System Context)

> Macro-arquitetura do Emma's Librarian: como o usuário interage com o sistema e quais sistemas externos são consumidos.

## Diagrama

```mermaid
flowchart TB
    subgraph Usuario["👤 Pesquisador / Usuário"]
        U[Usuário Desktop]
    end

    subgraph EmmaApp["📚 Emma's Librarian (Electron Desktop App)"]
        direction TB
        subgraph Renderer["Renderer Process (React + Vite)"]
            UI["Interface React\n(Pages, Components, Hooks)"]
        end
        subgraph MainProcess["Main Process (Electron / Node.js)"]
            IPC["IPC Bridge\n(preload.ts + handlers.ts)"]
            Services["Serviços de Negócio\n(SearchOrchestrator, AIService,\nExportService, QueryTranslator,\nApiIntegrator, SyncService)"]
            DB["DatabaseManager\n(better-sqlite3)"]
        end
    end

    subgraph ExternalAPIs["🌐 APIs Externas de Busca Científica"]
        OA["OpenAlex API\n(aberta)"]
        CR["Crossref API\n(aberta)"]
        SC["Scopus API\n(requer API Key)"]
        WOS["Web of Science API\n(requer API Key)"]
    end

    subgraph AIProviders["🤖 Provedores de IA"]
        OPENAI["OpenAI API\n(gpt-4o-mini)"]
        GEMINI["Gemini API\n(gemini-2.5-flash)"]
        OLLAMA["Ollama / Local LLM\n(OpenAI-compatible)"]
    end

    subgraph Storage["💾 Armazenamento Local"]
        SQLite[("emma.db\nSQLite")]
        PDFs["📁 storage/pdfs/\n(Arquivos PDF locais)"]
    end

    subgraph GitHub["☁️ GitHub Releases"]
        AutoUpdate["electron-updater\n(Auto-atualização)"]
    end

    U -->|"Interage via GUI"| UI
    UI <-->|"IPC invoke/on"| IPC
    IPC --> Services
    Services --> DB
    DB <--> SQLite
    Services -->|"HTTP fetch"| OA
    Services -->|"HTTP fetch"| CR
    Services -->|"HTTP + API Key"| SC
    Services -->|"HTTP + API Key"| WOS
    Services -->|"HTTP + API Key"| OPENAI
    Services -->|"HTTP + API Key"| GEMINI
    Services -->|"HTTP"| OLLAMA
    Services -->|"fs read/write"| PDFs
    MainProcess -.->|"Checa atualizações"| AutoUpdate
```

## Descrição

| Camada | Responsabilidade |
|---|---|
| **Usuário** | Pesquisador que interage com a interface desktop |
| **Renderer Process** | Frontend React com páginas, componentes e serviços de comunicação IPC |
| **Main Process** | Backend Electron com serviços de negócio, orquestração e acesso a dados |
| **APIs de Busca** | Fontes externas de metadados acadêmicos (2 abertas + 2 com API key) |
| **Provedores de IA** | LLMs para resumo, extração massiva e extração de metadados de PDF |
| **Armazenamento Local** | SQLite para dados estruturados + filesystem para PDFs |
| **GitHub Releases** | Canal de distribuição e auto-atualização via electron-updater |
