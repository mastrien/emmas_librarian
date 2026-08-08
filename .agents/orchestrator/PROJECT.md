# Project: emmas_librarian Development Diary

## Architecture & Overview
`emmas_librarian` is an academic research, PDF management, vector indexing, and publication preparation desktop application for scholars. It evolved from an early Python/FastAPI web prototype into a standalone Electron + React + SQLite desktop environment featuring local ONNX vector embeddings, cloud AI integrations (Gemini, Ollama), citation generation (ABNT/BibTeX), automated GFS backups, relational taxonomy management, scientific deadline tracking, and full E2E/Mutation testing.

## Feature Inventory & Phase Decomposition
| # | Phase Position | Phase Title | Commit Range | Target Subagent | Status |
|---|----------------|-------------|--------------|-----------------|--------|
| 1 | Fase 0 | Concepção, Fundação Python/FastAPI e Protótipo MVP Web | Commits 1–19 | worker_phase_0 | PLANNED |
| 2 | Fase 1 | Arquitetura Desktop Standalone Electron & Reestruturação do Repositório | Commits 20–33 | worker_phase_1 | PLANNED |
| 3 | Fase 2 | Integração com IA, Polimento Nativo Desktop & Automação de Releases | Commits 34–50 | worker_phase_2 | PLANNED |
| 4 | Fase 3 | Módulos Avançados de Análise, Pacotes de Sincronização (.emmapcarc) & Caderno de Escrita | Commits 51–60 | worker_phase_3 | PLANNED |
| 5 | Fase 4 | Auditorias Arquiteturais, Infraestrutura de Testes e Estabilização do Core | Commits 61–71 | worker_phase_4 | PLANNED |
| 6 | Fase 5 | Expansão da Produtividade Acadêmica, Portabilidade e Motor de Citações (ABNT/BibTeX) | Commits 72–91 | worker_phase_5 | PLANNED |
| 7 | Fase 6 | Matriz Taxonômica Interativa, Ergonomia UI/UX e Estabilização de Concorrência | Commits 92–120 | worker_phase_6 | PLANNED |
| 8 | Fase 7 | Arquitetura Enterprise de Backup, Rotação GFS e Lixeira com Historização | Commits 121–129 | worker_phase_7 | PLANNED |
| 9 | Fase 8 | Refatoração da Taxonomia Relacional, Suíte Integrada de Testes (E2E/k6/Stryker) | Commits 130–155 | worker_phase_8 | PLANNED |
| 10 | Fase 9 | Módulo de Agenda Científica e Gestão de Prazos, Padronização ISO & Resolução de Auditoria | Commits 156–169 | worker_phase_9 | PLANNED |
| 11 | Fase 10 | Provedores IA Cloud & Transição do Motor de Vetorização Local para ONNX/WASM | Commits 170–182 | worker_phase_10 | PLANNED |

## Requirements for Each Phase Draft (Mandatory Elements)
Every phase draft MUST include:
1. **Título da Fase**
2. **Posição** (ex: Fase 0, Fase 1...)
3. **Resumo Executivo**
4. **Detalhamento Profundo**:
   - Engineering decisions & architecture evolution rationale
   - Mermaid architecture/flow diagrams
   - Folder structure tables (showing file/module layout at that phase)
   - Key code snippets extracted directly from commit diffs
