import os

base_dir = r"c:\root_lab\antigravity\emmas_librarian"
agents_dir = os.path.join(base_dir, ".agents")
output_file = os.path.join(base_dir, "development_diary.md")

# 1. Read header part written in previous step
with open(output_file, "r", encoding="utf-8") as f:
    header_content = f.read()

# List of all 11 draft files
draft_files = [
    os.path.join(agents_dir, f"phase_{i}_worker", "draft.md")
    for i in range(11)
]

phase_contents = []
for idx, draft_path in enumerate(draft_files):
    if not os.path.exists(draft_path):
        raise FileNotFoundError(f"Draft file not found: {draft_path}")
    with open(draft_path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        phase_contents.append(content)

conclusion_content = """## Conclusão e Arquitetura Consolidada

O desenvolvimento do **Emma's Librarian** ao longo de seus ~182 commits culminou em uma solução desktop robusta, madura e totalmente soberana para pesquisadores acadêmicos. O projeto evoluiu de uma prova de conceito cliente-servidor desacoplada em Python para um ecossistema **Local-First** integrado em Electron e TypeScript de ponta a ponta.

### Diagrama de Arquitetura Consolidada (Estado Final - Fase 10)

```mermaid
graph TD
    subgraph Client_Layer ["Camada de Interface (React 18 + Vite + TypeScript)"]
        UI_Pages["Páginas: Dashboard, ProjectDetails, ArticleReader, AgendaPage, SettingsPage"]
        UI_Components["Componentes: QueryBuilder, CategoryCell, WritingPad, DeadlineBanner, MassCitationModal"]
        UI_Lib["Bibliotecas: Chart.js, citation-js (ABNT/BibTeX), react-pdf-highlighter"]
    end

    subgraph IPC_Bridge ["Barramento IPC Seguro (Preload & ContextBridge)"]
        Preload["electron/preload.ts (contextBridge.exposeInMainWorld)"]
        Channels["Enum IpcChannel fortemente tipado"]
    end

    subgraph Main_Process ["Processo Principal Electron (Node.js 22)"]
        MainApp["electron/main.ts (CSP Dinâmica, Lifecycle, Frameless Window)"]
        IPCHandlers["electron/ipc/ipcRegistries.ts (withErrorHandling)"]
        
        subgraph Core_Services ["Serviços e Repositórios Nativos"]
            DBAdapter["DatabaseAdapter.ts (better-sqlite3 / WAL Mode)"]
            SyncSvc["SyncService.ts (Transporte .emmapcarc / .emmabak via AdmZip)"]
            BackupSvc["BackupService.ts (Rotação GFS / GZIP .db.gz)"]
            ExportSvc["ExportService.ts (Scopus CSV / XLSX / Biblioshiny)"]
            VenueRepo["ScientificVenueRepository.ts (Agenda & Deadlines)"]
            AISvc["AIService.ts / EmbeddingService.ts"]
        end
    end

    subgraph AI_Engine ["Motor Híbrido de Inteligência Artificial & Vetorização"]
        subgraph Cloud_Providers ["Provedores em Nuvem"]
            OpenAI["OpenAI API (gpt-4o-mini)"]
            Gemini["Google Gemini API (batchEmbedContents + Backoff Retry)"]
            OllamaCloud["Ollama Cloud Gateway (Bearer Auth / OpenAI Spec)"]
        end
        
        subgraph Local_Engine ["Vetorização Local Zero-Setup"]
            ONNX["Motor ONNX / WASM (@xenova/transformers)\\nModelo: Xenova/all-MiniLM-L6-v2 (100% Offline)"]
        end
    end

    subgraph Persistence ["Camada de Persistência Local & Disco"]
        SQLite_DB[("SQLite 3 (emma.db)\\nPRAGMA foreign_keys = ON\\nPRAGMA journal_mode = WAL")]
        PDF_Storage["Storage Local de PDFs e Documentos\\n(userData/storage/pdfs/)"]
        GFS_Backups["Diretório de Backups Rotacionados GFS\\n(userData/backups/*.db.gz)"]
        Trash_Bin["Lixeira Lógica (Soft Delete: deleted_at)"]
    end

    UI_Pages --> UI_Components
    UI_Components --> UI_Lib
    UI_Pages --> Preload
    Preload --> Channels
    Channels --> IPCHandlers

    IPCHandlers --> MainApp
    IPCHandlers --> DBAdapter
    IPCHandlers --> SyncSvc
    IPCHandlers --> BackupSvc
    IPCHandlers --> ExportSvc
    IPCHandlers --> VenueRepo
    IPCHandlers --> AISvc

    AISvc --> Cloud_Providers
    AISvc --> Local_Engine

    DBAdapter --> SQLite_DB
    SQLite_DB --> Trash_Bin
    SyncSvc --> PDF_Storage
    BackupSvc --> GFS_Backups
```

### Síntese dos Pilares da Aplicação

1. **Arquitetura Desktop Standalone & Desempenho Local-First**: O abandono do servidor backend em Python eliminou a sobrecarga de conexões HTTP locais e permitiu empacotar uma aplicação leve de ~120 MB em executável NSIS para Windows com inicialização instantânea.
2. **Garantia de Qualidade e Cobertura Multidimensional**: Suíte de testes integrando Vitest (thresholds de 80% no processo Main), Playwright para testes automatizados E2E em Electron, Stryker Mutator para engenharia de mutações (cobertura de ramos atingindo 84.34%) e benchmarks k6/JMeter validados sobre 100.000 registros bibliográficos.
3. **Portabilidade Soberana e Segurança Enterprise**: Os formatos proprietários `.emmapcarc` e `.emmabak` garantem que o pesquisador possa exportar, migrar e restaurar seus acervos bibliográficos com total privacidade, respaldado pela rotação de backups GFS e recuperação contra falhas de concorrência com o flushing preventivo do WAL no SQLite.
4. **Ergonomia e Produtividade Acadêmica de Ponta a Ponta**: Da construção de buscas booleanas visuais à leitura interativa de PDFs com destaques ancorados, geração de referências ABNT/BibTeX, rascunho de escrita (*Writing Pad*), matriz de taxonomia qualitativa e acompanhamento de prazos de submissão na Agenda Científica, o **Emma's Librarian** estabelece um novo padrão para ferramentas de apoio à pesquisa científica.
"""

full_document = header_content.strip() + "\n\n" + "\n\n---\n\n".join(phase_contents) + "\n\n---\n\n" + conclusion_content.strip() + "\n"

with open(output_file, "w", encoding="utf-8") as f:
    f.write(full_document)

print(f"Successfully generated {output_file} with {len(full_document.splitlines())} lines.")
